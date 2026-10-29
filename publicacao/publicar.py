#!/usr/bin/env python3
"""Publica no Instagram os posts de publicacao/agenda.csv cujo horario ja chegou.

Roda pelo GitHub Actions (.github/workflows/instagram.yml) a cada 15 minutos.
As midias sao servidas pelo proprio site (GitHub Pages), porque a API do
Instagram busca o arquivo por uma URL publica.

agenda.csv (UTF-8, separado por virgula):
  id,data_hora,tipo,midia,legenda
  15-10_12h_reel,2026-10-15 12:00,reel,publicacao/midia/15-10_12h_reel.mp4,"Legenda..."
  15-10_15h_story,2026-10-15 15:00,story,publicacao/midia/15-10_15h_story.jpg,

  data_hora: horario de Brasilia. tipo: reel ou story. Story vai sem legenda.
  Imagens precisam ser JPEG (a API nao aceita PNG).

O que ja foi publicado (ou pulado) fica em publicados.json, para nao repetir.
"""
import csv
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

BASE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(BASE)
AGENDA = os.path.join(BASE, "agenda.csv")
ESTADO = os.path.join(BASE, "publicados.json")
TZ = ZoneInfo("America/Sao_Paulo")

# Um post atrasado ate JANELA_HORAS ainda sai; mais que isso e pulado,
# para nao despejar varios posts de uma vez depois de uma pausa.
JANELA = timedelta(hours=float(os.environ.get("JANELA_HORAS") or 3))
SITE = (os.environ.get("SITE_URL") or "https://gcsenterprise.com.br").rstrip("/")
HOST = os.environ.get("IG_API_HOST") or "graph.facebook.com"
VERSAO = os.environ.get("IG_API_VERSION") or "v23.0"
TOKEN = os.environ.get("IG_ACCESS_TOKEN", "")
USUARIO = os.environ.get("IG_USER_ID", "")
TESTE = os.environ.get("DRY_RUN") == "1"
# Linhas do aviso por e-mail (o workflow comenta na issue "Publicacoes do Instagram").
AVISO = os.environ.get("AVISO_ARQUIVO", "")
avisos = []


def avisar(linha):
    print(linha)
    avisos.append(linha)


def api(metodo, caminho, params):
    url = f"https://{HOST}/{VERSAO}/{caminho}"
    dados = urllib.parse.urlencode({**params, "access_token": TOKEN})
    if metodo == "GET":
        req = urllib.request.Request(f"{url}?{dados}")
    else:
        req = urllib.request.Request(url, data=dados.encode(), method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        corpo = e.read().decode(errors="replace")[:500]
        raise RuntimeError(f"{metodo} {caminho}: HTTP {e.code} {corpo}") from None


def publicar(post):
    url = f"{SITE}/{post['midia'].lstrip('/')}"
    video = url.lower().endswith((".mp4", ".mov"))
    tipo = post["tipo"].strip().lower()
    if tipo == "reel":
        params = {
            "media_type": "REELS",
            "video_url": url,
            "caption": post.get("legenda") or "",
            "share_to_feed": "true",
        }
    elif tipo == "story":
        params = {"media_type": "STORIES", ("video_url" if video else "image_url"): url}
    else:
        raise RuntimeError(f"tipo desconhecido: {post['tipo']!r}")

    # As vezes o Instagram diz que o container esta FINISHED e, no media_publish,
    # responde "Media Not Found" (subcodigo 2207006). Nesse caso o post nao saiu:
    # tenta de novo no mesmo container e, se continuar, cria outro.
    for tentativa in range(3):
        container = criar_container(params)
        for _ in range(2):
            try:
                return api("POST", f"{USUARIO}/media_publish", {"creation_id": container})["id"]
            except RuntimeError as e:
                if not pode_repetir(e):
                    raise
                erro = e
                print(f"media_publish falhou (tentativa {tentativa + 1}), tentando de novo: {e}")
                time.sleep(20)
    raise erro


def criar_container(params):
    container = api("POST", f"{USUARIO}/media", params)["id"]
    # Video leva alguns minutos para ser processado pelo Instagram.
    for _ in range(40):
        status = api("GET", container, {"fields": "status_code"}).get("status_code")
        if status == "FINISHED":
            return container
        if status in ("ERROR", "EXPIRED"):
            raise RuntimeError(f"container {container}: {status}")
        time.sleep(15)
    raise RuntimeError(f"container {container}: tempo esgotado")


def pode_repetir(erro):
    # So repete o "Media Not Found" e os erros que o Instagram marca como passageiros.
    texto = str(erro)
    return "2207006" in texto or '"is_transient":true' in texto


def link(media_id):
    try:
        return api("GET", media_id, {"fields": "permalink"}).get("permalink", "")
    except RuntimeError:
        return ""


def main():
    if not os.path.exists(AGENDA):
        print("Sem publicacao/agenda.csv: nada a fazer.")
        return 0
    if not (TOKEN and USUARIO) and not TESTE:
        print("Segredos IG_ACCESS_TOKEN / IG_USER_ID nao configurados: nada a fazer.")
        return 0

    if TESTE and TOKEN and USUARIO:
        # Confere a credencial sem publicar nada.
        try:
            conta = api("GET", USUARIO, {"fields": "username"})
            print(f"Credencial OK: conta @{conta.get('username')} (id {conta.get('id')})")
        except RuntimeError as e:
            print(f"ERRO na credencial: {e}")
            return 1

    estado = {}
    if os.path.exists(ESTADO):
        with open(ESTADO, encoding="utf-8") as f:
            estado = json.load(f)
    with open(AGENDA, newline="", encoding="utf-8-sig") as f:
        posts = list(csv.DictReader(f))

    agora = datetime.now(TZ)
    falhas = 0
    for post in sorted(posts, key=lambda p: p["data_hora"]):
        pid = post["id"].strip()
        if pid in estado:
            continue
        quando = datetime.strptime(post["data_hora"].strip(), "%Y-%m-%d %H:%M").replace(tzinfo=TZ)
        if quando > agora:
            continue
        if agora - quando > JANELA:
            estado[pid] = {"status": "pulado", "motivo": "horario passou", "em": agora.isoformat()}
            avisar(f"⏭️ {pid} pulado: era para {quando:%d/%m %H:%M} e passou do horário")
            continue
        if not os.path.exists(os.path.join(REPO, post["midia"].lstrip("/"))):
            falhas += 1
            avisar(f"❌ {pid}: mídia não encontrada no repositório ({post['midia']})")
            continue
        if TESTE:
            print(f"[teste] publicaria {pid} ({post['tipo']}) de {quando:%d/%m %H:%M}")
            continue
        try:
            media_id = publicar(post)
        except Exception as e:  # tenta de novo na proxima execucao, dentro da janela
            falhas += 1
            avisar(f"❌ {pid} não foi publicado (tenta de novo em 15 min): {e}")
            continue
        estado[pid] = {"status": "publicado", "media_id": media_id, "em": agora.isoformat()}
        avisar(f"✅ {pid} publicado. {link(media_id)}".rstrip())

    if AVISO and avisos:
        with open(AVISO, "w", encoding="utf-8") as f:
            f.write("\n\n".join(avisos) + "\n")
    if not TESTE:
        with open(ESTADO, "w", encoding="utf-8") as f:
            json.dump(estado, f, ensure_ascii=False, indent=2, sort_keys=True)
            f.write("\n")
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(main())
