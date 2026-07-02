"use client";

import { useState } from "react";

import { BadgeAlerta } from "../alertas/BadgeAlerta";
import { PainelAlertas } from "../alertas/PainelAlertas";
import { useAuth } from "../../hooks/useAuth";
import { useAlertas } from "../../hooks/useAlertas";

export function Topbar() {
  const [open, setOpen] = useState(false);
  const [painelAberto, setPainelAberto] = useState(false);
  const [buscaMobileAberta, setBuscaMobileAberta] = useState(false);
  const { logout, user, userProfile } = useAuth();
  const { contagemNaoLidos } = useAlertas();
  const displayName = userProfile?.nome || user?.displayName || "Usuario";
  const initial = displayName.trim().charAt(0).toUpperCase() || "U";

  return (
    <header className="topbar">
      <label className="topbar__search topbar__search--desktop">
        <span>Busca</span>
        <span className="topbar__search-icon" aria-hidden="true" />
        <input type="search" placeholder="Buscar modulo, produto ou alerta" />
      </label>

      <button
        className="topbar__search-trigger"
        type="button"
        aria-label="Abrir busca"
        onClick={() => setBuscaMobileAberta(true)}
      >
        <span className="topbar__search-icon" aria-hidden="true" />
      </button>

      <div className="topbar__actions">
        <button
          className="topbar__notification"
          type="button"
          aria-label="Abrir alertas"
          onClick={() => setPainelAberto(true)}
        >
          {contagemNaoLidos > 0 ? <span className="topbar__notification-dot" /> : null}
          <BadgeAlerta count={contagemNaoLidos} />
        </button>
        <PainelAlertas aberto={painelAberto} onFechar={() => setPainelAberto(false)} />

        <div className="topbar__user">
          <button
            className="topbar__user-button"
            type="button"
            aria-expanded={open}
            aria-label="Menu do usuario"
            onClick={() => setOpen((current) => !current)}
          >
            <span className="topbar__avatar">{initial}</span>
            <span className="topbar__user-name">{displayName}</span>
          </button>

          {open ? (
            <div className="topbar__dropdown">
              <a href="/configuracoes">Configuracoes</a>
              <button type="button" onClick={logout}>
                Sair
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {buscaMobileAberta ? (
        <div className="mobile-search" role="dialog" aria-label="Busca mobile">
          <div className="mobile-search__panel">
            <header>
              <strong>Buscar</strong>
              <button type="button" onClick={() => setBuscaMobileAberta(false)}>
                Fechar
              </button>
            </header>
            <label className="topbar__search mobile-search__field">
              <span>Busca</span>
              <span className="topbar__search-icon" aria-hidden="true" />
              <input autoFocus type="search" placeholder="Buscar modulo, produto ou alerta" />
            </label>
            <div className="mobile-search__quick-links" aria-label="Acessos rapidos">
              <a href="/estoque">Estoque</a>
              <a href="/compras">Compras</a>
              <a href="/producao">Producao</a>
              <a href="/precificacao">Precificacao</a>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
