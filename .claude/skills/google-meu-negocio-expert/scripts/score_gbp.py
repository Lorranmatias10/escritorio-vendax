#!/usr/bin/env python3
"""Calcula o score de um Google Business Profile a partir do JSON do checklist.

Uso:
    python score_gbp.py auditoria.json          # saída legível
    python score_gbp.py auditoria.json --json   # saída estruturada
    python score_gbp.py --exemplo               # imprime um JSON de exemplo

Campos desconhecidos podem ser null: o score é calculado sobre os pontos
avaliáveis e re-escalado, e as lacunas são listadas. Veja
references/auditoria-checklist.md para a definição de cada item.
"""
import json
import sys

PESOS = {"B": 25, "C": 30, "D": 15, "E": 15, "F": 15}

EXEMPLO = {
    "negocio": "Clínica Exemplo",
    "cidade": "São Paulo",
    "keyword_principal": "dermatologista em moema",
    "A": {"verificado": True, "nome_conforme": True, "tipo_correto": True, "endereco_real": True,
          "sem_duplicado": True, "sem_suspensao": True, "dono_e_empresa": None},
    "B": {"categoria_primaria": 8, "categorias_secundarias": 2, "servicos": 3, "descricao": 1,
          "atributos": 0, "horarios": 3},
    "C": {"reviews_90d": 4, "nota_media": 4.6, "total_reviews": 87, "mediana_top3_reviews": 140,
          "taxa_resposta_pct": 40, "resposta_em_48h": False, "respostas_personalizadas": False,
          "fotos_total": 23, "dias_desde_ultima_foto": 60, "citacoes": 1},
    "D": {"link_relevante": 1, "title_servico_cidade": 0, "nap_schema": None, "mobile_rapido": None,
          "agendamento_whatsapp": 2, "telefone_ok": 2},
    "E": {"dias_desde_ultimo_post": 45, "qa_count": 0, "produtos_aplicavel": False, "produtos": 0,
          "campo_atualizado_30d": False, "chat_ativo": False},
    "F": {"posicao_media_grid": 9, "share_of_voice": 0, "gap_categoria": 0, "gap_reviews": 0},
}


def faixa(valor, degraus):
    """degraus: lista de (limite_inferior, pontos) em ordem decrescente de limite."""
    for lim, pts in degraus:
        if valor >= lim:
            return pts
    return 0


def item(nome, pts, maximo, lacunas, itens):
    if pts is None:
        lacunas.append(nome)
    else:
        itens.append((nome, pts, maximo))


def pilar_B(d, lacunas, itens):
    for k, mx in [("categoria_primaria", 8), ("categorias_secundarias", 4), ("servicos", 5),
                  ("descricao", 3), ("atributos", 2), ("horarios", 3)]:
        v = d.get(k)
        item(f"B.{k}", None if v is None else min(v, mx), mx, lacunas, itens)


def pilar_C(d, lacunas, itens):
    r = d.get("reviews_90d")
    item("C1.reviews_90d", None if r is None else faixa(r, [(12, 8), (6, 6), (1, 3)]), 8, lacunas, itens)
    n = d.get("nota_media")
    item("C2.nota_media", None if n is None else faixa(n, [(4.5, 4), (4.3, 3), (4.0, 1)]), 4, lacunas, itens)
    t, m = d.get("total_reviews"), d.get("mediana_top3_reviews")
    if t is None or m is None:
        item("C3.total_vs_top3", None, 4, lacunas, itens)
    else:
        ratio = t / m if m else 2
        item("C3.total_vs_top3", faixa(ratio, [(1.0, 4), (0.6, 2)]), 4, lacunas, itens)
    tr = d.get("taxa_resposta_pct")
    r48 = d.get("resposta_em_48h")
    if tr is None:
        item("C4.taxa_resposta", None, 5, lacunas, itens)
    else:
        pts = 5 if (tr >= 100 and r48) else (4 if tr >= 95 else faixa(tr, [(80, 3), (50, 2), (1, 1)]))
        item("C4.taxa_resposta", pts, 5, lacunas, itens)
    p = d.get("respostas_personalizadas")
    item("C5.respostas_personalizadas", None if p is None else (2 if p else 0), 2, lacunas, itens)
    f = d.get("fotos_total")
    item("C6.fotos_total", None if f is None else faixa(f, [(50, 3), (20, 2), (5, 1)]), 3, lacunas, itens)
    df = d.get("dias_desde_ultima_foto")
    item("C7.fotos_recencia", None if df is None else (2 if df < 30 else 1 if df < 90 else 0), 2, lacunas, itens)
    c = d.get("citacoes")
    item("C8.citacoes", None if c is None else min(c, 2), 2, lacunas, itens)


def pilar_D(d, lacunas, itens):
    for k, mx in [("link_relevante", 3), ("title_servico_cidade", 3), ("nap_schema", 3),
                  ("mobile_rapido", 2), ("agendamento_whatsapp", 2), ("telefone_ok", 2)]:
        v = d.get(k)
        item(f"D.{k}", None if v is None else min(v, mx), mx, lacunas, itens)


def pilar_E(d, lacunas, itens):
    dp = d.get("dias_desde_ultimo_post")
    item("E1.post_recencia", None if dp is None else (4 if dp < 7 else 2 if dp < 30 else 0), 4, lacunas, itens)
    q = d.get("qa_count")
    item("E2.qa", None if q is None else (3 if q >= 5 else 1 if q >= 1 else 0), 3, lacunas, itens)
    if d.get("produtos_aplicavel"):
        v = d.get("produtos")
        item("E3.produtos", None if v is None else min(v, 2), 2, lacunas, itens)
    for k, mx in [("campo_atualizado_30d", 3), ("chat_ativo", 3)]:
        v = d.get(k)
        item(f"E.{k}", None if v is None else (mx if v else 0), mx, lacunas, itens)


def pilar_F(d, lacunas, itens):
    p = d.get("posicao_media_grid")
    item("F1.posicao_grid", None if p is None else (6 if p <= 3 else 4 if p <= 7 else 2 if p <= 15 else 0), 6, lacunas, itens)
    for k, mx in [("share_of_voice", 4), ("gap_categoria", 3), ("gap_reviews", 2)]:
        v = d.get(k)
        item(f"F.{k}", None if v is None else min(v, mx), mx, lacunas, itens)


def calcular(dados):
    A = dados.get("A", {})
    bloqueantes = ["verificado", "nome_conforme", "endereco_real", "sem_duplicado", "sem_suspensao"]
    falhas_A = [k for k in bloqueantes if A.get(k) is False]
    lacunas_A = [f"A.{k}" for k in A if A.get(k) is None]

    resultado = {"negocio": dados.get("negocio"), "keyword": dados.get("keyword_principal"),
                 "bloqueado": bool(falhas_A), "falhas_conformidade": falhas_A, "pilares": {},
                 "lacunas": lacunas_A, "gargalos": []}

    todos_itens = []
    for nome, fn in [("B", pilar_B), ("C", pilar_C), ("D", pilar_D), ("E", pilar_E), ("F", pilar_F)]:
        lac, its = [], []
        fn(dados.get(nome, {}), lac, its)
        obtido = sum(p for _, p, _ in its)
        avaliavel = sum(m for _, _, m in its)
        total = PESOS[nome] if nome != "E" or dados.get("E", {}).get("produtos_aplicavel") else PESOS[nome] - 2
        escalado = round(obtido / avaliavel * total, 1) if avaliavel else None
        resultado["pilares"][nome] = {"obtido": obtido, "avaliavel": avaliavel, "maximo": total,
                                      "score": escalado, "cobertura_pct": round(avaliavel / total * 100) if total else 0}
        resultado["lacunas"].extend(lac)
        todos_itens.extend(its)

    scores = [v["score"] for v in resultado["pilares"].values() if v["score"] is not None]
    maximos = [v["maximo"] for v in resultado["pilares"].values() if v["score"] is not None]
    global_ = round(sum(scores) / sum(maximos) * 100) if maximos else None
    resultado["score_global"] = 0 if falhas_A else global_

    # Confiança: proporção dos 100 pontos que foi realmente avaliada
    total_max = sum(v["maximo"] for v in resultado["pilares"].values())
    avaliado = sum(v["avaliavel"] for v in resultado["pilares"].values())
    cobertura = round(avaliado / total_max * 100) if total_max else 0
    resultado["cobertura_global_pct"] = cobertura
    resultado["confianca"] = "alta" if cobertura >= 80 else "media" if cobertura >= 60 else "baixa"

    # Gargalos: itens com maior déficit (pontos perdidos), top 3
    deficit = sorted(((m - p, n, p, m) for n, p, m in todos_itens if m - p > 0), reverse=True)
    resultado["gargalos"] = [{"item": n, "obtido": p, "maximo": m, "perdidos": d} for d, n, p, m in deficit[:3]]
    return resultado


def imprimir(r):
    print(f"\n=== Score GBP — {r['negocio'] or 'negócio'} ({r['keyword'] or 'keyword?'}) ===")
    if r["bloqueado"]:
        print(f"BLOQUEADO por conformidade: {', '.join(r['falhas_conformidade'])}. Score global = 0 até resolver.")
    if r["score_global"] is None:
        print("Score global: não calculável (nenhum dado avaliável). Preencha o checklist.\n")
    else:
        print(f"Score global: {r['score_global']}/100  "
              f"(confiança {r['confianca'].upper()} — {r['cobertura_global_pct']}% dos pontos avaliados)")
        if r["confianca"] == "baixa":
            print("ATENÇÃO: com menos de 60% dos dados, o score é apenas indicativo. "
                  "Não use em relatório para cliente sem completar a coleta.")
        print()
    for n, v in r["pilares"].items():
        s = "n/d" if v["score"] is None else f"{v['score']}/{v['maximo']}"
        print(f"  Pilar {n}: {s}  (cobertura dos dados: {v['cobertura_pct']}%)")
    if r["gargalos"]:
        print("\nMaiores gargalos (pontos perdidos):")
        for g in r["gargalos"]:
            print(f"  - {g['item']}: {g['obtido']}/{g['maximo']} (-{g['perdidos']})")
    if r["lacunas"]:
        print("\nDados faltando (preencha para um score mais fiel):")
        print("  " + ", ".join(r["lacunas"]))
    print()


def main():
    args = sys.argv[1:]
    if "--exemplo" in args:
        print(json.dumps(EXEMPLO, ensure_ascii=False, indent=2))
        return
    if not args:
        print(__doc__)
        sys.exit(1)
    with open(args[0], encoding="utf-8") as f:
        dados = json.load(f)
    r = calcular(dados)
    if "--json" in args:
        print(json.dumps(r, ensure_ascii=False, indent=2))
    else:
        imprimir(r)


if __name__ == "__main__":
    main()

