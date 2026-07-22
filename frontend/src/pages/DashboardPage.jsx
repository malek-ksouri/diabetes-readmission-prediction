import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Building2, TrendingDown, Repeat, Target } from "lucide-react";
import { getDashboardStats, getModelInfo, verifierSante } from "../api";

// Libellés lisibles pour les variables (facteurs de risque).
const LIBELLES_VAR = {
  number_inpatient: "Hospitalisations antérieures",
  number_emergency: "Passages aux urgences",
  number_outpatient: "Consultations externes",
  time_in_hospital: "Durée du séjour",
  num_medications: "Nombre de médicaments",
  num_lab_procedures: "Analyses de laboratoire",
  num_procedures: "Procédures médicales",
  number_diagnoses: "Nombre de diagnostics",
};
function libelleVar(v) { return LIBELLES_VAR[v] || v; }

// ---- Graphique en barres verticales (SVG) ----
// data : [{ label, valeur }], valeur en % ou en nombre.
function BarChart({ data, maxValeur, unite = "%", couleurAccent = "#7c5cfc" }) {
  if (!data || data.length === 0) return null;
  const max = maxValeur || Math.max(...data.map((d) => d.valeur));
  const largeurBarre = 100 / data.length;

  return (
    <div className="barchart">
      <svg viewBox="0 0 400 180" preserveAspectRatio="none" className="barchart-svg">
        {data.map((d, i) => {
          const hauteur = max > 0 ? (d.valeur / max) * 150 : 0;
          const x = i * (400 / data.length) + (400 / data.length) * 0.15;
          const w = (400 / data.length) * 0.7;
          const y = 160 - hauteur;
          return (
            <g key={i}>
              <rect x={x} y={y} width={w} height={hauteur} rx="4"
                fill={couleurAccent} opacity={0.85} />
            </g>
          );
        })}
      </svg>
      <div className="barchart-labels">
        {data.map((d, i) => (
          <div key={i} className="barchart-label" style={{ width: `${largeurBarre}%` }}>
            <span className="barchart-valeur">{d.valeur}{unite}</span>
            <span className="barchart-nom">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  const [apiEnLigne, setApiEnLigne] = useState(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    let actif = true;
    Promise.all([
      getDashboardStats().catch(() => null),
      getModelInfo().catch(() => null),
      verifierSante().catch(() => false),
    ]).then(([s, m, sante]) => {
      if (!actif) return;
      setStats(s);
      setModelInfo(m);
      setApiEnLigne(sante);
      if (!s) setErreur(true);
    });
    return () => { actif = false; };
  }, []);

  const apercu = stats?.apercu;
  const seuil = modelInfo?.seuil_decision;

  // Données pour le graphique taux par âge
  const donneesAge = (stats?.taux_par_age || []).map((d) => ({
    label: d.groupe.replace(/[[\])]/g, "").replace("-", "–"),
    valeur: d.taux,
  }));
  const maxTauxAge = Math.max(10, ...(stats?.taux_par_age || []).map((d) => d.taux));

  // Données pour le graphique taux par spécialité (barres verticales)
  const LIBELLES_SPE = {
    "Orthopedics": "Orthopédie",
    "InternalMedicine": "Méd. interne",
    "Family/GeneralPractice": "Méd. générale",
    "Surgery-General": "Chirurgie",
    "Emergency/Trauma": "Urgences",
    "Cardiology": "Cardiologie",
    "Radiologist": "Radiologie",
    "Orthopedics-Reconstructive": "Ortho-recon.",
  };
  const donneesSpecialite = (stats?.taux_par_specialite || []).map((d) => ({
    label: LIBELLES_SPE[d.specialite] || d.specialite,
    valeur: d.taux,
  }));
  const maxTauxSpe = Math.max(10, ...(stats?.taux_par_specialite || []).map((d) => d.taux));

  // Données pour la répartition par sexe (donut)
  const repSexe = stats?.repartition_sexe || [];
  const totalSexe = repSexe.reduce((s, d) => s + d.nombre, 0);
  const femmes = repSexe.find((d) => d.sexe === "Female")?.nombre || 0;
  const hommes = repSexe.find((d) => d.sexe === "Male")?.nombre || 0;
  const pctFemmes = totalSexe ? (femmes / totalSexe) * 100 : 0;
  const pctHommes = totalSexe ? (hommes / totalSexe) * 100 : 0;

  return (
    <>
      {/* HERO */}
      <div className="hero" style={{ marginBottom: "1.4rem" }}>
        <div className="hero-blob" />
        <div className="hero-blob-2" />
        <span className="hero-eyebrow">Aide à la décision clinique</span>
        <h1>Tableau de bord</h1>
        <p>Vue d'ensemble de la population diabétique analysée et du modèle de prédiction de réadmission précoce.</p>
        <Link to="/prediction" className="hero-bouton">Nouvelle prédiction →</Link>
      </div>

      {erreur && (
        <div className="carte" style={{ marginBottom: "1.4rem" }}>
          <p className="erreur" style={{ margin: 0 }}>
            Statistiques indisponibles. Lance l'API (uvicorn) et génère le fichier
            (python generer_stats.py), puis recharge la page.
          </p>
        </div>
      )}

      {/* RANGÉE STATS */}
      <div className="stats-rangee" style={{ marginBottom: "1.4rem" }}>
        <div className="stat-carte">
          <div className="stat-haut"><span className="stat-label">Séjours analysés</span><span className="stat-icone"><Building2 size={16} strokeWidth={1.8} /></span></div>
          <span className="stat-valeur">{apercu ? apercu.total_sejours.toLocaleString("fr-FR") : "—"}</span>
          <span className="stat-sous">Population du modèle</span>
        </div>
        <div className="stat-carte">
          <div className="stat-haut"><span className="stat-label">Taux de réadmission</span><span className="stat-icone"><TrendingDown size={16} strokeWidth={1.8} /></span></div>
          <span className="stat-valeur">{apercu ? `${apercu.taux_readmission_pct}%` : "—"}</span>
          <span className="stat-sous">Réadmis à moins de 30 jours</span>
        </div>
        <div className="stat-carte">
          <div className="stat-haut"><span className="stat-label">Patients réadmis</span><span className="stat-icone"><Repeat size={16} strokeWidth={1.8} /></span></div>
          <span className="stat-valeur">{apercu ? apercu.readmis_30j.toLocaleString("fr-FR") : "—"}</span>
          <span className="stat-sous">Cas positifs dans la cohorte</span>
        </div>
        <div className="stat-carte">
          <div className="stat-haut"><span className="stat-label">Seuil du modèle</span><span className="stat-icone"><Target size={16} strokeWidth={1.8} /></span></div>
          <span className="stat-valeur">{seuil != null ? `${(seuil * 100).toFixed(0)}%` : "—"}</span>
          <span className="stat-sous">{modelInfo?.critere_seuil || "F2-optimal"}</span>
        </div>
      </div>

      {/* GRILLE PRINCIPALE */}
      <div className="dash-grille">
        <div className="dash-colonne">
          {/* Taux par âge */}
          <div className="carte">
            <div className="carte-entete-lien">
              <h2>Taux de réadmission par tranche d'âge</h2>
            </div>
            {donneesAge.length > 0 ? (
              <>
                <BarChart data={donneesAge} maxValeur={maxTauxAge} unite="%" />
                <p className="dash-note">
                  Le risque de réadmission augmente nettement avec l'âge, culminant
                  chez les patients de 80 à 90 ans.
                </p>
              </>
            ) : (
              <p className="placeholder">Chargement des données…</p>
            )}
          </div>

          {/* Taux par spécialité médicale */}
          <div className="carte">
            <div className="carte-entete-lien">
              <h2>Taux de réadmission par spécialité</h2>
            </div>
            {donneesSpecialite.length > 0 ? (
              <>
                <BarChart data={donneesSpecialite} maxValeur={maxTauxSpe} unite="%" />
                <p className="dash-note">
                  Le taux de réadmission varie selon le service. L'orthopédie et la
                  médecine interne présentent les taux les plus élevés.
                </p>
              </>
            ) : (
              <p className="placeholder">Chargement des données…</p>
            )}
          </div>

          {/* Répartition par sexe */}
          <div className="carte">
            <div className="carte-entete-lien">
              <h2>Répartition par sexe</h2>
            </div>
            {totalSexe > 0 ? (
              <div className="sexe-tuile">
                <div className="donut-centre-conteneur">
                  <svg width="150" height="150" viewBox="0 0 150 150">
                    <circle cx="75" cy="75" r="60" fill="none" stroke="var(--bordure)" strokeWidth="18" />
                    <circle cx="75" cy="75" r="60" fill="none"
                      stroke="var(--accent)" strokeWidth="18"
                      strokeDasharray={`${(pctFemmes / 100) * 2 * Math.PI * 60} ${2 * Math.PI * 60}`}
                      strokeLinecap="round" transform="rotate(-90 75 75)" />
                    <text x="75" y="70" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--texte)">
                      {(totalSexe / 1000).toFixed(0)}k
                    </text>
                    <text x="75" y="90" textAnchor="middle" fontSize="11" fill="var(--texte-gris)">
                      patients
                    </text>
                  </svg>
                </div>
                <div className="donut-legende">
                  <div className="donut-item">
                    <span className="donut-pastille" style={{ background: "var(--accent)" }} />
                    Femmes
                    <strong>{pctFemmes.toFixed(0)}% ({femmes.toLocaleString("fr-FR")})</strong>
                  </div>
                  <div className="donut-item">
                    <span className="donut-pastille" style={{ background: "var(--bordure-forte)" }} />
                    Hommes
                    <strong>{pctHommes.toFixed(0)}% ({hommes.toLocaleString("fr-FR")})</strong>
                  </div>
                </div>
              </div>
            ) : (
              <p className="placeholder">Chargement des données…</p>
            )}
          </div>
        </div>

        <div className="dash-colonne">
          {/* Santé du modèle */}
          <div className="carte">
            <h3>État du système</h3>
            <div className="info-liste">
              <div className="info-ligne">
                <span className="info-cle">API</span>
                <span className={"badge-pilule" + (apiEnLigne ? "" : " rouge")}>
                  {apiEnLigne === null ? "…" : apiEnLigne ? "En ligne" : "Hors ligne"}
                </span>
              </div>
              <div className="info-ligne"><span className="info-cle">Modèle</span><span className="info-val">LightGBM</span></div>
              <div className="info-ligne"><span className="info-cle">Calibration</span><span className="info-val">Platt</span></div>
              <div className="info-ligne"><span className="info-cle">Seuil actif</span><span className="info-val">{seuil != null ? `${(seuil * 100).toFixed(0)}%` : "—"}</span></div>
              <div className="info-ligne">
                <span className="info-cle">Données</span>
                <span className="info-val">{stats?._meta?.nb_lignes ? stats._meta.nb_lignes.toLocaleString("fr-FR") : "—"}</span>
              </div>
            </div>
          </div>

          {/* Répartition population (moyennes) */}
          {stats?.moyennes && (
            <div className="carte">
              <h3>Profil moyen d'un séjour</h3>
              <div className="info-liste">
                <div className="info-ligne"><span className="info-cle">Durée du séjour</span><span className="info-val">{stats.moyennes.time_in_hospital} j</span></div>
                <div className="info-ligne"><span className="info-cle">Médicaments</span><span className="info-val">{stats.moyennes.num_medications}</span></div>
                <div className="info-ligne"><span className="info-cle">Diagnostics</span><span className="info-val">{stats.moyennes.number_diagnoses}</span></div>
              </div>
            </div>
          )}

          {/* Promo analyse par lot */}
          <div className="hero" style={{ minHeight: "auto", padding: "1.8rem" }}>
            <div className="hero-blob" />
            <span className="hero-eyebrow">Plusieurs patients</span>
            <h1 style={{ fontSize: "1.4rem", maxWidth: "100%" }}>Analyse par lot</h1>
            <p style={{ maxWidth: "100%", fontSize: "0.86rem" }}>Importez un CSV pour classer vos patients par priorité de suivi.</p>
            <Link to="/analyse-lot" className="hero-bouton">Analyser un lot →</Link>
          </div>
        </div>
      </div>
    </>
  );
}

export default DashboardPage;