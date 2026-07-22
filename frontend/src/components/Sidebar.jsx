import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Stethoscope,
  ClipboardList,
  BarChart3,
  Brain,
  Info,
  Sun,
  Moon,
} from "lucide-react";

// Sidebar : navigation principale avec icônes Lucide (taille et stroke cohérents).

const LIENS = [
  { to: "/", label: "Dashboard", Icone: LayoutDashboard, exact: true },
  { to: "/prediction", label: "Prédiction", Icone: Stethoscope, exact: false },
  { to: "/analyse-lot", label: "Analyse par lot", Icone: ClipboardList, exact: false },
  { to: "/performance", label: "Performance", Icone: BarChart3, exact: false },
  { to: "/comprendre-modele", label: "Comprendre le modèle", Icone: Brain, exact: false },
  { to: "/a-propos", label: "À propos", Icone: Info, exact: false },
];

function Sidebar({ sombre, onToggleTheme }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-marque">
        <div className="sidebar-logo">D</div>
        <div className="sidebar-titre">DiabRisk</div>
      </div>

      <div className="sidebar-nav-zone">
        <div className="sidebar-label">Menu</div>
        <nav className="sidebar-liens">
          {LIENS.map(({ to, label, Icone, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) => "sidebar-lien" + (isActive ? " actif" : "")}
            >
              <Icone className="sidebar-icone" size={18} strokeWidth={1.8} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <button className="theme-toggle" onClick={onToggleTheme}
        aria-label={sombre ? "Passer en mode clair" : "Passer en mode sombre"}>
        <span className="theme-toggle-icone">
          {sombre ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />}
        </span>
        <span>{sombre ? "Mode clair" : "Mode sombre"}</span>
      </button>

      <div className="sidebar-promo">
        <strong>Rappel clinique</strong>
        <p>Les probabilités affichées sont calibrées : un score de 30 % correspond à environ 30 % de risque réel.</p>
      </div>

      <div className="sidebar-profil">
        <div className="sidebar-avatar">Dr</div>
        <div>
          <div className="sidebar-profil-nom">Praticien</div>
          <div className="sidebar-profil-role">Service diabétologie</div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;