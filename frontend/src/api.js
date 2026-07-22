// api.js
// =======
// Centralise l'adresse de l'API et les appels réseau.
// Un seul endroit à modifier pour changer l'URL (dev → prod).

// En dev, l'API tourne sur le port 8000 (uvicorn).
// Astuce : si tu passes en prod plus tard, remplace par une variable
// d'environnement Vite : import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"
export const API_URL = "http://127.0.0.1:8000";

/**
 * Prédiction pour un patient.
 * @param {object} patient - données brutes du patient
 * @returns {Promise<object>} résultat de prédiction
 */
export async function predirePatient(patient) {
  const reponse = await fetch(`${API_URL}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patient),
  });
  if (!reponse.ok) {
    throw new Error("Erreur API");
  }
  return reponse.json();
}

/**
 * Analyse par lot : envoie un fichier CSV de patients.
 * @param {File} fichier - fichier CSV sélectionné par l'utilisateur
 * @returns {Promise<object>} { total_patients, patients_a_risque, resultats }
 */
export async function analyserLot(fichier) {
  const formData = new FormData();
  formData.append("file", fichier);

  const reponse = await fetch(`${API_URL}/predict-batch`, {
    method: "POST",
    body: formData, // pas de Content-Type manuel : le navigateur le règle
  });
  if (!reponse.ok) {
    // On tente de lire le message d'erreur renvoyé par l'API (detail).
    let message = "Erreur lors de l'analyse du fichier";
    try {
      const err = await reponse.json();
      if (err.detail) message = err.detail;
    } catch {
      // réponse non-JSON, on garde le message générique
    }
    throw new Error(message);
  }
  return reponse.json();
}

/**
 * Génère et télécharge le rapport PDF d'un patient.
 * @param {object} patient
 */
export async function telechargerRapportPDF(patient) {
  const reponse = await fetch(`${API_URL}/rapport-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patient),
  });
  if (!reponse.ok) {
    throw new Error("Erreur lors de la génération du PDF");
  }
  // Récupère le PDF en blob et déclenche le téléchargement
  const blob = await reponse.blob();
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  lien.href = url;
  lien.download = `rapport_patient_${date}.pdf`;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  URL.revokeObjectURL(url);
}

/**
 * Récupère l'importance globale des features (SHAP) — page Comprendre le modèle.
 * @returns {Promise<object>}
 */
export async function getShapGlobal() {
  const reponse = await fetch(`${API_URL}/shap-global`);
  if (!reponse.ok) {
    throw new Error("Erreur API");
  }
  return reponse.json();
}

/**
 * Récupère les statistiques du dataset (page Dashboard).
 * @returns {Promise<object>}
 */
export async function getDashboardStats() {
  const reponse = await fetch(`${API_URL}/dashboard-stats`);
  if (!reponse.ok) {
    throw new Error("Erreur API");
  }
  return reponse.json();
}

/**
 * Récupère les infos et métriques du modèle (page Performance).
 * @returns {Promise<object>}
 */
export async function getModelInfo() {
  const reponse = await fetch(`${API_URL}/model-info`);
  if (!reponse.ok) {
    throw new Error("Erreur API");
  }
  return reponse.json();
}

/**
 * Vérifie que l'API répond (utilisé pour un indicateur d'état éventuel).
 * @returns {Promise<boolean>}
 */
export async function verifierSante() {
  try {
    const reponse = await fetch(`${API_URL}/health`);
    return reponse.ok;
  } catch {
    return false;
  }
}