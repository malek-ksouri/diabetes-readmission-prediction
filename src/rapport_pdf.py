"""
Génération d'un rapport PDF d'évaluation du risque de réadmission.
Utilise ReportLab. Appelé par l'API (endpoint /rapport-pdf).
"""
from io import BytesIO
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
)
from reportlab.lib.enums import TA_LEFT

# --- Palette cohérente avec le dashboard ---
BLEU = colors.HexColor("#2563EB")
TEXTE = colors.HexColor("#111827")
GRIS = colors.HexColor("#6B7280")
BORDURE = colors.HexColor("#E5E7EB")
FOND_DOUX = colors.HexColor("#F9FAFB")
ROUGE = colors.HexColor("#DC2626")
VERT = colors.HexColor("#16A34A")
AMBRE = colors.HexColor("#D97706")

# Libellés cliniques (mêmes que le frontend)
LIBELLES = {
    "number_inpatient": "Hospitalisations antérieures",
    "number_emergency": "Passages aux urgences",
    "number_outpatient": "Consultations externes",
    "time_in_hospital": "Durée du séjour",
    "num_medications": "Nombre de médicaments",
    "num_lab_procedures": "Analyses de laboratoire",
    "num_procedures": "Procédures médicales",
    "number_diagnoses": "Nombre de diagnostics",
    "score_risque_hospitalier": "Score de risque hospitalier",
    "age_numeric": "Âge", "age_group": "Groupe d'âge",
    "diabetesMed": "Traitement diabète", "insulin": "Insuline",
    "metformin": "Metformine", "change": "Changement de traitement",
    "discharge_disposition_id_1": "Sortie à domicile",
    "diag_1_Circulatoire": "Diagnostic : circulatoire",
    "diag_1_Respiratoire": "Diagnostic : respiratoire",
    "diag_1_Diabete": "Diagnostic : diabète",
    "diag_2_Respiratoire": "Diagnostic secondaire : respiratoire",
}


def _libelle(feature: str) -> str:
    nom = feature.replace("num__", "").replace("cat__", "")
    return LIBELLES.get(nom, nom)


def _couleur_niveau(niveau: str):
    return {
        "Faible": VERT, "Modéré": AMBRE,
        "Élevé": colors.HexColor("#EA580C"), "Très élevé": ROUGE,
    }.get(niveau, GRIS)


def generer_rapport_pdf(patient: dict, resultat: dict) -> bytes:
    """
    Construit le rapport PDF à partir des données patient et du résultat
    de prédiction. Renvoie les octets du PDF.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        topMargin=20 * mm, bottomMargin=20 * mm,
        leftMargin=20 * mm, rightMargin=20 * mm,
        title="Rapport d'évaluation du risque de réadmission",
    )

    styles = getSampleStyleSheet()
    style_titre = ParagraphStyle(
        "Titre", parent=styles["Title"], fontName="Helvetica-Bold",
        fontSize=18, textColor=TEXTE, spaceAfter=4, alignment=TA_LEFT,
    )
    style_sous = ParagraphStyle(
        "Sous", parent=styles["Normal"], fontSize=10, textColor=GRIS, spaceAfter=2,
    )
    style_h2 = ParagraphStyle(
        "H2", parent=styles["Heading2"], fontName="Helvetica-Bold",
        fontSize=12, textColor=TEXTE, spaceBefore=16, spaceAfter=8,
    )
    style_normal = ParagraphStyle(
        "Corps", parent=styles["Normal"], fontSize=10, textColor=TEXTE, leading=15,
    )
    style_petit = ParagraphStyle(
        "Petit", parent=styles["Normal"], fontSize=8.5, textColor=GRIS, leading=12,
    )

    elements = []

    # --- En-tête ---
    elements.append(Paragraph("Rapport d'évaluation du risque", style_titre))
    elements.append(Paragraph(
        "Réadmission hospitalière précoce (moins de 30 jours) — patient diabétique",
        style_sous))
    elements.append(Paragraph(
        f"Généré le {datetime.now().strftime('%d/%m/%Y à %H:%M')}", style_sous))
    elements.append(Spacer(1, 6))
    elements.append(HRFlowable(width="100%", thickness=1, color=BORDURE))

    # --- Résultat principal ---
    elements.append(Paragraph("Résultat de l'évaluation", style_h2))

    proba = resultat.get("probabilite", 0)
    niveau = resultat.get("niveau_risque", "—")
    seuil = resultat.get("seuil", 0)
    a_risque = resultat.get("a_risque", False)
    couleur_niv = _couleur_niveau(niveau)

    donnees_resultat = [
        ["Probabilité de réadmission", f"{proba * 100:.1f} %"],
        ["Niveau de risque", niveau],
        ["Seuil de décision", f"{seuil * 100:.0f} %"],
        ["Classification", "À risque" if a_risque else "Sous le seuil"],
    ]
    t = Table(donnees_resultat, colWidths=[70 * mm, 90 * mm])
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), GRIS),
        ("TEXTCOLOR", (1, 0), (1, -1), TEXTE),
        ("TEXTCOLOR", (1, 1), (1, 1), couleur_niv),  # niveau en couleur
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, FOND_DOUX]),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, BORDURE),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(t)

    # Recommandation
    reco = resultat.get("recommandation", "")
    if reco:
        elements.append(Spacer(1, 10))
        elements.append(Paragraph(f"<b>Recommandation :</b> {reco}", style_normal))

    # --- Facteurs déterminants ---
    facteurs = resultat.get("facteurs", [])
    if facteurs:
        elements.append(Paragraph("Facteurs déterminants", style_h2))
        elements.append(Paragraph(
            "Facteurs ayant le plus influencé cette estimation (méthode SHAP).",
            style_petit))
        elements.append(Spacer(1, 6))

        lignes = [["Facteur", "Effet sur le risque"]]
        for f in facteurs:
            sens = f.get("sens", "")
            fleche = "↑ augmente" if sens == "augmente" else "↓ diminue"
            lignes.append([_libelle(f.get("feature", "")), fleche])

        tf = Table(lignes, colWidths=[110 * mm, 50 * mm])
        style_tf = [
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 0), (-1, -1), 9.5),
            ("TEXTCOLOR", (0, 0), (-1, 0), GRIS),
            ("BACKGROUND", (0, 0), (-1, 0), FOND_DOUX),
            ("LINEBELOW", (0, 0), (-1, -1), 0.5, BORDURE),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ]
        # Colorer la colonne effet selon le sens
        for i, f in enumerate(facteurs, start=1):
            c = ROUGE if f.get("sens") == "augmente" else VERT
            style_tf.append(("TEXTCOLOR", (1, i), (1, i), c))
        tf.setStyle(TableStyle(style_tf))
        elements.append(tf)

    # --- Données du patient ---
    elements.append(Paragraph("Données du patient", style_h2))
    champs_affiches = [
        ("age", "Âge"), ("gender", "Sexe"), ("race", "Origine"),
        ("time_in_hospital", "Durée du séjour"),
        ("num_medications", "Nombre de médicaments"),
        ("number_inpatient", "Hospitalisations antérieures"),
        ("number_emergency", "Passages aux urgences"),
        ("number_diagnoses", "Nombre de diagnostics"),
        ("diag_1", "Diagnostic principal"),
        ("A1Cresult", "Test A1c"), ("insulin", "Insuline"),
        ("diabetesMed", "Traitement diabète"),
        ("change", "Changement de traitement"),
    ]
    lignes_p = []
    for cle, label in champs_affiches:
        if cle in patient and patient[cle] is not None:
            lignes_p.append([label, str(patient[cle])])

    if lignes_p:
        # Deux colonnes de paires pour gagner de la place
        moitie = (len(lignes_p) + 1) // 2
        col_g = lignes_p[:moitie]
        col_d = lignes_p[moitie:]
        while len(col_d) < len(col_g):
            col_d.append(["", ""])
        table_data = []
        for g, d in zip(col_g, col_d):
            table_data.append([g[0], g[1], d[0], d[1]])
        tp = Table(table_data, colWidths=[42 * mm, 38 * mm, 42 * mm, 38 * mm])
        tp.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (0, -1), "Helvetica"),
            ("FONTNAME", (2, 0), (2, -1), "Helvetica"),
            ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
            ("FONTNAME", (3, 0), (3, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("TEXTCOLOR", (0, 0), (0, -1), GRIS),
            ("TEXTCOLOR", (2, 0), (2, -1), GRIS),
            ("TEXTCOLOR", (1, 0), (1, -1), TEXTE),
            ("TEXTCOLOR", (3, 0), (3, -1), TEXTE),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        elements.append(tp)

    # --- Avertissement ---
    elements.append(Spacer(1, 20))
    elements.append(HRFlowable(width="100%", thickness=1, color=BORDURE))
    elements.append(Spacer(1, 8))
    elements.append(Paragraph(
        "<b>Avertissement.</b> Ce rapport est un outil d'aide à la décision fondé "
        "sur un modèle statistique. Il ne remplace pas le jugement clinique du "
        "professionnel de santé. Les probabilités sont des estimations, non des "
        "certitudes. La décision finale relève de l'appréciation médicale.",
        style_petit))

    doc.build(elements)
    pdf = buffer.getvalue()
    buffer.close()
    return pdf


# --- Test autonome : génère un exemple ---
if __name__ == "__main__":
    patient_test = {
        "age": "[50-60)", "gender": "Female", "race": "Caucasian",
        "time_in_hospital": 8, "num_medications": 26,
        "number_inpatient": 8, "number_emergency": 2, "number_diagnoses": 9,
        "diag_1": "428", "A1Cresult": None, "insulin": "Up",
        "diabetesMed": "Yes", "change": "Ch",
    }
    resultat_test = {
        "probabilite": 0.469, "niveau_risque": "Très élevé", "seuil": 0.38,
        "a_risque": True,
        "recommandation": "Suivi renforcé recommandé (contact post-sortie, éducation thérapeutique).",
        "facteurs": [
            {"feature": "num__number_inpatient", "contribution": 1.5, "sens": "augmente"},
            {"feature": "num__score_risque_hospitalier", "contribution": 0.42, "sens": "augmente"},
            {"feature": "num__time_in_hospital", "contribution": 0.13, "sens": "augmente"},
            {"feature": "cat__diag_1_Circulatoire", "contribution": 0.11, "sens": "augmente"},
            {"feature": "num__number_emergency", "contribution": 0.10, "sens": "augmente"},
            {"feature": "cat__discharge_disposition_id_1", "contribution": -0.06, "sens": "diminue"},
        ],
    }
    pdf_bytes = generer_rapport_pdf(patient_test, resultat_test)
    with open("/home/claude/exemple_rapport.pdf", "wb") as f:
        f.write(pdf_bytes)
    print(f"PDF généré : {len(pdf_bytes)} octets")