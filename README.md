# Prédiction de réhospitalisation précoce des patients diabétiques

Système d'aide à la décision clinique estimant le risque de réadmission
hospitalière à moins de 30 jours chez des patients diabétiques, à partir des
données de leur séjour. Le projet couvre l'ensemble de la chaîne : nettoyage
des données, modélisation, calibration, évaluation, et mise à disposition via
une application web (API FastAPI + interface React).

---

## Sommaire

- [Contexte](#contexte)
- [Aperçu de l'application](#aperçu-de-lapplication)
- [Architecture du projet](#architecture-du-projet)
- [Installation](#installation)
- [Lancer l'application](#lancer-lapplication)
- [Démarche méthodologique](#démarche-méthodologique)
- [Performances du modèle](#performances-du-modèle)
- [Structure des dossiers](#structure-des-dossiers)
- [Limites](#limites)
- [Sources](#sources)

---

## Contexte

La réadmission hospitalière précoce est un enjeu majeur de qualité des soins et
de coûts. Chez les patients diabétiques, elle est fréquente et en partie
évitable par un suivi adapté à la sortie. L'objectif de cet outil est d'aider
les équipes soignantes à **repérer les patients qui bénéficieraient d'un suivi
renforcé**, en estimant leur risque de réadmission à moins de 30 jours.

Il s'agit d'un outil de **priorisation** : il classe les patients selon leur
niveau de risque, il ne prédit pas une réadmission avec certitude.

Le projet s'appuie sur le jeu de données *Diabetes 130-US Hospitals
(1999-2008)*, soit **69 987 séjours** après nettoyage, avec un taux de
réadmission précoce de **9 %**.

---

## Aperçu de l'application

L'application web comprend six pages :

- **Dashboard** — vue d'ensemble de la population et du modèle (statistiques,
  taux de réadmission par âge, facteurs de risque).
- **Prédiction individuelle** — évaluation du risque d'un patient à partir d'un
  formulaire, avec jauge de risque, facteurs déterminants (SHAP local),
  simulateur « et si… ? » et alerte visuelle pour les cas à risque très élevé.
- **Analyse par lot** — évaluation de plusieurs patients via un fichier CSV,
  avec tri par risque et export des résultats.
- **Performance** — métriques d'évaluation du modèle sur le jeu de test.
- **Comprendre le modèle** — importance globale des facteurs (SHAP), fiche
  d'identité du modèle et limites.
- **À propos** — contexte, démarche et sources.

---

## Architecture du projet

Le projet se décompose en trois parties :

**Le pipeline de modélisation** (notebooks) — du nettoyage des données à la
production du modèle final calibré, en passant par la modélisation,
l'optimisation et l'évaluation.

**L'API** (FastAPI) — expose le modèle via des points d'accès REST
(`/predict`, `/predict-batch`, `/dashboard-stats`, `/shap-global`, etc.). Elle
applique le même pipeline d'inférence que l'entraînement : données brutes →
feature engineering → preprocessing → modèle calibré → probabilité + SHAP.

**L'interface** (React + Vite) — consomme l'API et présente les résultats.

---

## Installation

### Prérequis

- Python 3.11
- Node.js 18 ou supérieur
- npm

### 1. Cloner et préparer l'environnement Python

```bash
# Créer et activer un environnement virtuel
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS / Linux

# Installer les dépendances Python
pip install -r requirements.txt
```

> **Important** : la librairie `shap` doit être installée dans le même
> environnement que l'API, sinon les facteurs déterminants ne s'afficheront
> pas. Elle est incluse dans `requirements.txt`.

### 2. Préparer le frontend

```bash
cd frontend
npm install
```

---

## Lancer l'application

L'application nécessite **deux serveurs** lancés simultanément, dans deux
terminaux distincts.

### Terminal 1 — API (backend)

```bash
# À la racine du projet, environnement virtuel activé
python -m uvicorn api.main:app --reload --port 8000
```

L'API est alors disponible sur `http://127.0.0.1:8000`.

### Terminal 2 — Interface (frontend)

```bash
cd frontend
npm run dev
```

L'interface est accessible sur `http://localhost:5173`.

---

## Démarche méthodologique

La fiabilité de l'outil repose sur plusieurs précautions méthodologiques :

**Prévention des fuites de données.** Un seul séjour est conservé par patient,
afin d'éviter que le modèle ne reconnaisse un patient déjà vu à l'entraînement.
Les jeux d'entraînement, de validation et de test sont strictement disjoints.

**Preprocessing sans fuite.** Le preprocessor (imputation, encodage,
standardisation) est ajusté uniquement sur les données d'entraînement, puis
appliqué aux jeux de validation et de test.

**Optimisation rigoureuse.** Les hyperparamètres du modèle sont optimisés par
Optuna avec validation croisée stratifiée à 5 plis, en maximisant la PR-AUC
(adaptée aux classes déséquilibrées).

**Calibration des probabilités.** Le modèle optimisé est calibré (méthode de
Platt) sur le jeu de validation. Un score de 30 % correspond ainsi réellement à
environ 30 % de risque, ce qui rend les probabilités directement
interprétables.

**Seuil de décision choisi honnêtement.** Le seuil (0,38) est déterminé sur le
jeu de validation en maximisant le F2-score, qui privilégie le rappel — car
dans un contexte médical, manquer un patient à risque est plus grave qu'une
fausse alerte. Le jeu de test n'est utilisé qu'une seule fois, à la fin, pour
l'évaluation finale.

**Cohérence entraînement / production vérifiée.** Un test de cohérence a
confirmé que l'API reproduit fidèlement le pipeline des notebooks (écart
maximal de l'ordre de 10⁻⁵ sur les probabilités).

---

## Performances du modèle

Évaluation sur le jeu de test (jamais utilisé pendant l'entraînement ou le choix
du seuil), avec le seuil officiel de 0,38 :

| Métrique | Valeur | IC 95 % |
|---|---|---|
| ROC-AUC | 0,642 | [0,623 – 0,660] |
| PR-AUC | 0,171 | [0,153 – 0,193] |
| Rappel | 0,604 | [0,573 – 0,637] |
| Précision | 0,129 | [0,119 – 0,140] |
| F2-Score | 0,349 | [0,327 – 0,370] |
| Brier (calibré) | 0,079 | — |

Ces performances sont **modestes mais cohérentes** avec la difficulté reconnue
de la prédiction de réadmission et avec la littérature sur ce jeu de données.
La cohérence entre les scores de validation et de test indique l'absence de
surapprentissage.

En pratique, le modèle **priorise utilement** : parmi les patients qu'il juge
les plus à risque, environ la moitié sont effectivement réadmis, contre 9 % en
population générale.


---

## Limites

Cet outil présente des limites qu'il est important de connaître :

- **Pouvoir prédictif modeste.** Le signal disponible dans les données est
  intrinsèquement faible : de nombreux déterminants d'une réadmission
  (observance, conditions de vie, suivi post-hospitalier) ne figurent pas dans
  le jeu de données. Les scores sont donc prudents.
- **Corrélation, pas causalité.** Le modèle identifie des associations
  statistiques, pas des relations de cause à effet. Agir sur un facteur ne
  garantit pas une baisse du risque.
- **Pas de dimension temporelle.** Chaque patient est évalué sur un seul
  séjour ; le modèle ne suit pas l'évolution dans le temps.
- **Données historiques et spécifiques.** Le modèle a appris sur des hôpitaux
  américains (1999-2008). Son transfert à d'autres contextes nécessiterait une
  réévaluation.
- **Aide à la décision, pas décision.** Cet outil éclaire le jugement clinique,
  il ne le remplace pas. La décision finale revient au professionnel de santé.

---

## Sources

- **Jeu de données** : Diabetes 130-US Hospitals for Years 1999-2008
  (UCI Machine Learning Repository).
- **Référence** : Strack et al. (2014), *Impact of HbA1c Measurement on
  Hospital Readmission Rates: Analysis of 70,000 Clinical Database Patient
  Records*.
- **Modèle** : LightGBM optimisé (Optuna) et calibré (Platt).
- **Explicabilité** : SHAP (TreeExplainer).

---

## Stack technique

- **Modélisation** : Python, scikit-learn, LightGBM, Optuna, SHAP
- **API** : FastAPI, uvicorn, pydantic
- **Interface** : React, Vite, lucide-react



---
# Guide des commandes — Projet de prédiction de réhospitalisation

Ce document rassemble **toutes les commandes** nécessaires pour installer,
préparer et lancer le projet de bout en bout. Les commandes sont données pour
**Windows (PowerShell)**. Pour macOS / Linux, les différences sont signalées.

> Convention : `[racine]` désigne le dossier racine du projet
> (`diabetes-readmission-prediction`). Adaptez les chemins à votre organisation.

---

## Sommaire

1. [Installation initiale (une seule fois)](#1-installation-initiale-une-seule-fois)
2. [Préparation des données et du modèle](#2-préparation-des-données-et-du-modèle)
3. [Génération des fichiers du dashboard](#3-génération-des-fichiers-du-dashboard)
4. [Lancer l'application au quotidien](#4-lancer-lapplication-au-quotidien)
5. [Vérifications et tests](#5-vérifications-et-tests)
6. [Dépannage](#6-dépannage)

---

## 1. Installation initiale (une seule fois)

### 1.1 Créer et activer l'environnement virtuel Python

```powershell
# Depuis [racine]
python -m venv .venv

# Activer (Windows PowerShell)
.venv\Scripts\activate

# Activer (macOS / Linux)
# source .venv/bin/activate
```

Une fois activé, votre invite de commande commence par `(.venv)`.

### 1.2 Installer les dépendances Python

```powershell
pip install --upgrade pip

# Si un requirements.txt existe :
pip install -r requirements.txt

# Sinon, installer les librairies principales manuellement :
pip install pandas numpy scikit-learn lightgbm optuna shap joblib
pip install fastapi uvicorn pydantic python-multipart
```

> **Crucial** : `shap` doit être installé dans **cet** environnement (celui qui
> lance l'API). Sans lui, les facteurs déterminants ne s'affichent pas.

### 1.3 Générer le fichier requirements.txt (recommandé)

Pour figer la liste exacte de vos librairies :

```powershell
pip freeze > requirements.txt
```

### 1.4 Installer les dépendances du frontend

```powershell
cd frontend
npm install
cd ..
```

---

## 2. Préparation des données et du modèle

> À faire uniquement si les fichiers `.pkl` (modèle, preprocessor) et les CSV
> n'existent pas encore, ou si vous voulez tout régénérer depuis zéro.
> Exécuter les notebooks **dans l'ordre**.

Lancer Jupyter :

```powershell
# Environnement virtuel activé
jupyter notebook
# ou, selon votre installation :
jupyter lab
```

Puis exécuter les notebooks dans cet ordre (via « Run All » dans chacun) :

1. `01_exploration.ipynb` — exploration des données (optionnel)
2. `04_preprocessing.ipynb` — nettoyage, split, preprocessing → produit
   `preprocessor.pkl` et les `X_*.pkl` / `y_*.pkl`
3. `05_modelisation.ipynb` — modèles baseline → produit `lgbm_baseline.pkl`
4. `06_optimisation.ipynb` — optimisation Optuna → produit `lgbm_tuned.pkl`
5. `07_evaluation.ipynb` — calibration, seuil, SHAP → produit
   `lgbm_final_calibrated.pkl`, `seuil_officiel.json`, `shap_importance.json`
   et la figure `shap_summary.png`

> Le fichier `lgbm_final_calibrated.pkl` produit par le NB07 est **le modèle
> utilisé par l'API**.

---

## 3. Génération des fichiers du dashboard

### 3.1 Statistiques du dashboard

```powershell
# Depuis [racine], environnement activé
python generer_stats.py
```

Produit `reports/dashboard_stats.json` (alimente la page Dashboard).

### 3.2 Copier la figure SHAP pour l'affichage web

La page « Comprendre le modèle » affiche `shap_summary.png`. Il faut la copier
depuis le dossier des figures vers le dossier public du frontend :

```powershell
# Adapter le chemin source selon l'emplacement réel de la figure
copy reports\figures\shap_summary.png frontend\public\shap_summary.png
```

---

## 4. Lancer l'application au quotidien

C'est la partie que vous utiliserez le plus souvent. L'application nécessite
**deux terminaux ouverts en même temps**.

### Terminal 1 — API (backend)

```powershell
# Depuis [racine]
.venv\Scripts\activate
python -m uvicorn api.main:app --reload --port 8000
```

Attendre le message `Uvicorn running on http://127.0.0.1:8000`.
**Laisser ce terminal ouvert.**

### Terminal 2 — Interface (frontend)

```powershell
cd frontend
npm run dev
```

Attendre le message indiquant `Local: http://localhost:5173`.
**Laisser ce terminal ouvert.**

### Ouvrir le dashboard

Dans un navigateur : `http://localhost:5173`

### Arrêter les serveurs

Dans chaque terminal, appuyer sur `Ctrl + C`.

---

## 5. Vérifications et tests

### 5.1 Vérifier que shap est bien installé (pour l'API)

```powershell
# Environnement de l'API activé
python -c "import shap; print('shap OK', shap.__version__)"
```

### 5.2 Vérifier que l'API répond

Une fois l'API lancée, dans un navigateur ou un autre terminal :

```powershell
# Vérifier l'état de santé de l'API
curl http://127.0.0.1:8000/health
```

La documentation interactive de l'API est aussi accessible sur
`http://127.0.0.1:8000/docs`.

### 5.3 Vérifier quel modèle l'API charge

```powershell
# Environnement activé, depuis [racine]
python -c "import sys; sys.path.insert(0, 'src'); from prediction import MODEL_PATH; print(MODEL_PATH)"
```

Doit afficher le chemin vers `lgbm_final_calibrated.pkl`.

---

## 6. Dépannage

### « uvicorn n'est pas reconnu »

Lancer uvicorn via Python plutôt que directement :

```powershell
python -m uvicorn api.main:app --reload --port 8000
```

### Les facteurs déterminants ne s'affichent pas

La librairie `shap` n'est probablement pas installée dans l'environnement de
l'API :

```powershell
pip install shap
# Puis redémarrer l'API (Ctrl+C dans le terminal, puis relancer)
```

### « ModuleNotFoundError » au lancement de l'API

Une dépendance manque. Réinstaller les dépendances :

```powershell
pip install -r requirements.txt
```

### Le frontend ne démarre pas / erreur de module

Réinstaller les dépendances Node, notamment après un changement :

```powershell
cd frontend
npm install
npm run dev
```

### Le dashboard s'ouvre mais n'affiche pas de données

Vérifier que l'API (Terminal 1) tourne bien. Le frontend a besoin de l'API pour
récupérer les prédictions et les statistiques.

### La page « Comprendre le modèle » n'affiche pas la figure SHAP

Vérifier que `shap_summary.png` est bien présent dans `frontend/public/`
(voir section 3.2).

---

## Récapitulatif express (usage quotidien)

Une fois l'installation faite, pour lancer le projet il suffit de :

```powershell
# Terminal 1
.venv\Scripts\activate
python -m uvicorn api.main:app --reload --port 8000

# Terminal 2
cd frontend
npm run dev
```

Puis ouvrir `http://localhost:5173`.















































Section Démographie
age [50-60) → sélectionne la tranche [50-60)
gender Female → Femme
race Caucasian → Caucasien
Section Séjour hospitalier
time_in_hospital 8 → Durée du séjour : 8
num_lab_procedures 48 → Analyses labo : 48
num_procedures 1 → Procédures : 1
num_medications 26 → Nb de médicaments : 26
medical_specialty nan → Spécialité médicale : laisse vide / « Non renseigné » (voir note plus bas)
discharge_disposition_id 1 → Destination de sortie : Domicile (le code 1 = sortie à domicile)
Section Historique hospitalier
number_inpatient 8 → Hospitalisations antérieures : 8
number_emergency 2 → Passages aux urgences : 2
number_outpatient 0 → Consultations externes : 0
number_diagnoses 9 → Nombre de diagnostics : 9
Section Diagnostics (ICD-9)
diag_1 428 → Diagnostic principal : 428 (insuffisance cardiaque)
diag_2 493 → Diagnostic secondaire : 493 (asthme)
diag_3 584 → Diagnostic tertiaire : 584 (insuffisance rénale aiguë)
A1Cresult nan → Test A1c : « Non mesuré » / « None » (voir note)
max_glu_serum nan → Glycémie sérique : « Non mesuré » / « None » (si ce champ existe)
Section Traitement
insulin Up → Insuline : Augmentée
metformin No → Metformine : Non
change Ch → Changement de traitement : Oui
diabetesMed Yes → Sous médicament diabète : Oui