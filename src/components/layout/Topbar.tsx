"use client";

import { useState } from "react";

import { useAlertas } from "../../hooks/useAlertas";
import { useAuth } from "../../hooks/useAuth";
import { isAdministrativeRole } from "../../lib/access-control";
import { BadgeAlerta } from "../alertas/BadgeAlerta";
import { PainelAlertas } from "../alertas/PainelAlertas";
import { ThemeToggle } from "./ThemeToggle";

type TopbarProps = {
  onOpenNavigation: () => void;
};

export function Topbar({ onOpenNavigation }: TopbarProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const { logout, user, userProfile } = useAuth();
  const { contagemNaoLidos } = useAlertas();
  const displayName = userProfile?.nome || user?.displayName || "Usuário";
  const initial = displayName.trim().charAt(0).toUpperCase() || "U";
  const administrative = isAdministrativeRole(userProfile?.role);

  return (
    <header className="topbar">
      <div className="topbar__leading">
        <button className="topbar__menu-button" type="button" onClick={onOpenNavigation} aria-label="Abrir navegação">
          <span />
          <span />
          <span />
        </button>

        <label className="topbar__search topbar__search--desktop">
          <span className="sr-only">Buscar</span>
          <span className="topbar__search-icon" aria-hidden="true" />
          <input type="search" placeholder="Buscar módulo, produto ou alerta" />
        </label>

        <button className="topbar__mobile-search-button" type="button" onClick={() => setMobileSearchOpen(true)} aria-label="Abrir busca">
          <span className="topbar__search-icon" aria-hidden="true" />
        </button>
      </div>

      <div className="topbar__actions">
        <ThemeToggle />

        <button className="topbar__notification" type="button" aria-label="Abrir alertas" onClick={() => setAlertsOpen(true)}>
          {contagemNaoLidos > 0 ? <span className="topbar__notification-dot" /> : null}
          <BadgeAlerta count={contagemNaoLidos} />
        </button>
        <PainelAlertas aberto={alertsOpen} onFechar={() => setAlertsOpen(false)} />

        <div className="topbar__user">
          <button
            className="topbar__user-button"
            type="button"
            aria-expanded={profileOpen}
            aria-label="Menu do usuário"
            onClick={() => setProfileOpen((current) => !current)}
          >
            <span className="topbar__avatar">{initial}</span>
            <span className="topbar__user-copy">
              <strong>{displayName}</strong>
              <small>{administrative ? "Gestão" : "Operação"}</small>
            </span>
          </button>

          {profileOpen ? (
            <div className="topbar__dropdown">
              {administrative ? <a href="/configuracoes">Configurações</a> : null}
              {administrative ? <a href="/planos">Plano e assinatura</a> : null}
              <button type="button" onClick={logout}>Sair</button>
            </div>
          ) : null}
        </div>
      </div>

      {mobileSearchOpen ? (
        <div className="mobile-search" role="dialog" aria-modal="true" aria-label="Busca">
          <button className="mobile-search__backdrop" type="button" onClick={() => setMobileSearchOpen(false)} aria-label="Fechar busca" />
          <div className="mobile-search__panel">
            <header>
              <strong>Buscar</strong>
              <button type="button" onClick={() => setMobileSearchOpen(false)}>Fechar</button>
            </header>
            <label className="topbar__search mobile-search__field">
              <span className="sr-only">Buscar</span>
              <span className="topbar__search-icon" aria-hidden="true" />
              <input autoFocus type="search" placeholder="Buscar módulo, produto ou alerta" />
            </label>
          </div>
        </div>
      ) : null}
    </header>
  );
}
