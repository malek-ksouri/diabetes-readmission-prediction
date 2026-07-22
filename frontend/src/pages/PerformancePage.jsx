import { useState, useEffect } from "react";
import { Target, Search, TrendingUp, BarChart3 } from "lucide-react";
import { getModelInfo } from "../api";

// Figures d'évaluation (servies depuis frontend/public/).
// Sélection : modèle final (matrice test + calibration) + comparaison des modèles (ROC + PR).
const FIGURES = [
  { titre: "Matrice de confusion (test, seuil 0,38)", src: "/confusion_matrix_test.png",
    desc: "Résultats du modèle final sur le jeu de test. En bas à droite : les patients à risque correctement identifiés." },
  { titre: "Courbe de calibration", src: "/calibration_curve.png",
    desc: "Fiabilité des probabilités avant et après calibration. La courbe verte, proche de la diagonale, montre l'amélioration (Brier 0,161 → 0,079)." },
  { titre: "Comparaison ROC des modèles", src: "/roc_curves_all_models.png",
    desc: "Pouvoir discriminant des quatre modèles testés (jeu de validation). Les performances sont proches, ce qui a orienté le choix vers la calibration." },
  { titre: "Comparaison précision-rappel", src: "/pr_curves_all_models.png",
    desc: "Compromis précision/rappel des quatre modèles (jeu de validation), métrique adaptée au fort déséquilibre des classes." },
];

// Affiche une figure ; disparaît proprement si le fichier est absent.
function FigureEval({ titre, src, desc }) {
  const [erreur, setErreur] = useState(false);
  if (erreur) return null;
  return (
    <div className="figure-eval">
      <h3 className="figure-titre">{titre}</h3>
      <div className="figure-image-conteneur">
        <img src={src} alt={titre} className="figure-image"
          onError={() => setErreur(true)} />
      </div>
      <p className="figure-desc">{desc}</p>
    </div>
  );
}

// Libellés lisibles pour les métriques techniques.
const LIBELLES_METRIQUES = {
  "roc_auc": "ROC-AUC",
  "pr_auc": "PR-AUC",
  "recall": "Rappel (sensibilité)",
  "precision": "Précision",
  "f2": "Score F2",
  "f1": "Score F1",
  "brier": "Score de Brier",
  "brier_score": "Score de Brier",
  "accuracy": "Exactitude",
};

const EXPLICATIONS = {
  "recall": "Part des patients réellement réadmis que le modèle détecte. Priorité clinique.",
  "precision": "Part des alertes qui correspondent à une vraie réadmission.",
  "pr_auc": "Qualité globale sur données déséquilibrées (mieux que ROC-AUC ici).",
  "roc_auc": "Capacité à distinguer réadmis et non-réadmis.",
  "f2": "Compromis précision/rappel qui favorise le rappel.",
  "brier": "Fiabilité des probabilités (plus bas = mieux).",
  "brier_score": "Fiabilité des probabilités (plus bas = mieux).",
};

function cleNorm(cle) {
  return cle.toLowerCase().replace(/[\s-]/g, "_");
}
function libelleMetrique(cle) {
  return LIBELLES_METRIQUES[cleNorm(cle)] || cle;
}
function explicationMetrique(cle) {
  return EXPLICATIONS[cleNorm(cle)] || null;
}

// Aplati la structure renvoyée par df.to_dict() en paires {nom, valeur}.
function extraireMetriques(metriques) {
  if (!metriques || typeof metriques !== "object") return [];
  const paires = [];
  for (const [colonne, contenu] of Object.entries(metriques)) {
    if (contenu && typeof contenu === "object") {
      for (const [ligne, valeur] of Object.entries(contenu)) {
        if (typeof valeur === "number") {
          const nom = isNaN(Number(ligne)) ? ligne : colonne;
          paires.push({ nom, valeur });
        }
      }
    } else if (typeof contenu === "number") {
      paires.push({ nom: colonne, valeur: contenu });
    }
  }
  return paires;
}

// Trouve une métrique par son nom normalisé (recall, precision...).
function chercher(metriques, cible) {
  const m = metriques.find((x) => cleNorm(x.nom) === cible);
  return m ? m.valeur : null;
}

// ---- Donut SVG (part de patients à risque vs non) ----
function Donut({ segments, centreValeur, centreLabel }) {
  const rayon = 70;
  const largeur = 22;
  const circ = 2 * Math.PI * rayon;
  let offset = 0;

  return (
    <div className="donut-centre-conteneur">
      <svg width="180" height="180" viewBox="0 0 180 180">
        <g transform="rotate(-90 90 90)">
          <circle cx="90" cy="90" r={rayon} fill="none" stroke="#edeef3" strokeWidth={largeur} />
          {segments.map((seg, i) => {
            const longueur = circ * seg.part;
            const dash = `${longueur} ${circ - longueur}`;
            const el = (
              <circle
                key={i}
                cx="90" cy="90" r={rayon}
                fill="none"
                stroke={seg.couleur}
                strokeWidth={largeur}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                style={{ transition: "stroke-dasharray 0.6s" }}
              />
            );
            offset += longueur;
            return el;
          })}
        </g>
        <text x="90" y="84" textAnchor="middle" fontSize="26" fontWeight="700" fill="#1e2233">
          {centreValeur}
        </text>
        <text x="90" y="104" textAnchor="middle" fontSize="11" fill="#8a90a6">
          {centreLabel}
        </text>
      </svg>
    </div>
  );
}

// ---- Barre horizontale pour une métrique ----
function BarreMetrique({ nom, valeur }) {
  return (
    <div className="barre-metrique-ligne">
      <div className="barre-metrique-haut">
        <span className="barre-metrique-nom">{libelleMetrique(nom)}</span>
        <span className="barre-metrique-val">{valeur.toFixed(3)}</span>
      </div>
      <div className="barre-metrique-piste">
        <div className="barre-metrique-remplissage" style={{ width: `${Math.min(valeur * 100, 100)}%` }} />
      </div>
    </div>
  );
}

function CarteMetrique({ nom, valeur }) {
  const explication = explicationMetrique(nom);
  return (
    <div className="metrique-carte">
      <span className="metrique-valeur">{valeur.toFixed(3)}</span>
      <span className="metrique-nom">{libelleMetrique(nom)}</span>
      {explication && <span className="metrique-explication">{explication}</span>}
    </div>
  );
}

function PerformancePage() {
  const [info, setInfo] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    let actif = true;
    getModelInfo()
      .then((d) => { if (actif) setInfo(d); })
      .catch(() => { if (actif) setErreur("Impossible de charger les infos du modèle. Vérifie que l'API tourne (uvicorn)."); })
      .finally(() => { if (actif) setChargement(false); });
    return () => { actif = false; };
  }, []);

  if (chargement) {
    return (
      <>
        <div className="page-entete"><h1>Performance du modèle</h1></div>
        <div className="carte"><p className="placeholder">Chargement des informations du modèle…</p></div>
      </>
    );
  }
  if (erreur) {
    return (
      <>
        <div className="page-entete"><h1>Performance du modèle</h1></div>
        <div className="carte"><p className="erreur">{erreur}</p></div>
      </>
    );
  }

  const metriques = extraireMetriques(info.metriques_test);

  // Cartes stats du haut : on pioche les métriques phares si présentes.
  const recall = chercher(metriques, "recall");
  const precision = chercher(metriques, "precision");
  const prauc = chercher(metriques, "pr_auc");
  const rocauc = chercher(metriques, "roc_auc");

  const cartesStats = [
    { label: "Seuil de décision", valeur: info.seuil_decision != null ? `${(info.seuil_decision * 100).toFixed(0)}%` : "—", Icone: Target, sous: info.critere_seuil || "F2-optimal" },
    { label: "Rappel", valeur: recall != null ? recall.toFixed(3) : "—", Icone: Search, sous: "Patients à risque détectés" },
    { label: "PR-AUC", valeur: prauc != null ? prauc.toFixed(3) : "—", Icone: TrendingUp, sous: "Qualité globale" },
    { label: "ROC-AUC", valeur: rocauc != null ? rocauc.toFixed(3) : "—", Icone: BarChart3, sous: "Discrimination" },
  ];

  // Donut : compromis rappel / manqués (ce que le modèle attrape vs rate).
  // Basé sur le recall — part des vrais positifs détectés.
  let donutSegments = null;
  if (recall != null) {
    donutSegments = [
      { label: "Détectés", part: recall, couleur: "#2563EB" },
      { label: "Manqués", part: 1 - recall, couleur: "#CBD5E1" },
    ];
  }

  return (
    <>
      <div className="page-entete">
        <h1>Performance du modèle</h1>
        <p>{info.modele}</p>
      </div>

      {/* Rangée de cartes statistiques */}
      <div className="stats-rangee">
        {cartesStats.map((c, i) => (
          <div className="stat-carte" key={i}>
            <div className="stat-haut">
              <span className="stat-label">{c.label}</span>
              <span className="stat-icone"><c.Icone size={16} strokeWidth={1.8} /></span>
            </div>
            <span className="stat-valeur">{c.valeur}</span>
            <span className="stat-sous">{c.sous}</span>
          </div>
        ))}
      </div>

      <div className="performance">
        {/* Graphiques : barres + donut côte à côte */}
        <div className="perf-grille-2">
          {metriques.length > 0 && (
            <div className="carte">
              <h2>Métriques sur le test</h2>
              <div className="barres-metriques">
                {metriques.map((m, i) => (
                  <BarreMetrique key={i} nom={m.nom} valeur={m.valeur} />
                ))}
              </div>
            </div>
          )}

          {donutSegments && (
            <div className="carte">
              <h2>Détection des patients à risque</h2>
              <Donut
                segments={donutSegments}
                centreValeur={`${(recall * 100).toFixed(0)}%`}
                centreLabel="détectés"
              />
              <div className="donut-legende">
                {donutSegments.map((s, i) => (
                  <div className="donut-item" key={i}>
                    <span className="donut-pastille" style={{ background: s.couleur }} />
                    <span>{s.label}</span>
                    <strong>{(s.part * 100).toFixed(1)}%</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Détail des métriques en cartes */}
        {metriques.length > 0 && (
          <div className="carte">
            <h2>Détail des métriques</h2>
            <div className="metriques-grille">
              {metriques.map((m, i) => (
                <CarteMetrique key={i} nom={m.nom} valeur={m.valeur} />
              ))}
            </div>
          </div>
        )}

        {/* Graphiques d'évaluation (figures du NB07) */}
        <div className="carte">
          <h2>Graphiques d'évaluation</h2>
          <p className="perf-texte">
            Visualisations produites lors de l'évaluation du modèle sur le jeu de test.
          </p>
          <div className="figures-grille">
            {FIGURES.map((fig) => (
              <FigureEval key={fig.src} titre={fig.titre} src={fig.src} desc={fig.desc} />
            ))}
          </div>
        </div>

        {/* Lecture des résultats */}
        <div className="carte">
          <h2>Comment lire ces résultats</h2>
          <p className="perf-texte">
            Ce modèle privilégie le <strong>rappel</strong> : mieux vaut signaler un patient
            qui finalement ne sera pas réadmis (fausse alerte) que de manquer un patient à
            risque. C'est un choix clinique délibéré, porté par le seuil de décision.
          </p>
          <p className="perf-texte">
            Les probabilités affichées sont <strong>calibrées</strong> (méthode de Platt) :
            une probabilité de 30 % correspond réellement à environ 30 % de patients réadmis.
            Cela rend l'outil fiable pour prioriser le suivi.
          </p>
          <p className="avertissement">
            {info.note || "Outil d'aide à la décision. Ne remplace pas le jugement clinique."}
          </p>
        </div>
      </div>
    </>
  );
}

export default PerformancePage;