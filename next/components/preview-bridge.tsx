'use client';

/**
 * Ponte de preview (só ativa quando a página roda DENTRO de um iframe, como no
 * painel de live preview do admin do Strapi). Faz duas coisas:
 *
 *  1. Avisa a janela-pai (o admin) qual a URL atual, via postMessage, para que
 *     ao recarregar o preview ele volte para a MESMA página (e não para a home).
 *  2. Salva/restaura a posição de scroll por página (sessionStorage), para que
 *     depois de uma edição+reload você caia onde estava, não no topo.
 *
 * Cross-origin (admin em :1340, site em :3000): o admin não consegue ler a
 * localização do iframe, por isso a página precisa "se reportar" por mensagem.
 */
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export function PreviewBridge() {
  const pathname = usePathname();

  useEffect(() => {
    // Só dentro de um iframe.
    if (typeof window === 'undefined' || window.self === window.top) return;

    const key = `preview-scroll:${pathname}`;

    // 1) Reporta a URL atual ao admin (a cada navegação interna do iframe).
    try {
      window.parent.postMessage(
        { type: 'preview:location', href: window.location.href },
        '*'
      );
    } catch {
      /* noop */
    }

    // 2) Restaura o scroll salvo (tenta algumas vezes p/ vencer layout shift,
    //    imagens carregando, hidratação, etc.).
    const saved = sessionStorage.getItem(key);
    if (saved != null) {
      const y = parseInt(saved, 10) || 0;
      [0, 60, 180, 400, 800].forEach((t) =>
        setTimeout(() => window.scrollTo(0, y), t)
      );
    }

    // Mantém o scroll salvo continuamente (assim o reload pega a posição atual).
    const save = () => {
      try {
        sessionStorage.setItem(key, String(window.scrollY));
      } catch {
        /* noop */
      }
    };
    window.addEventListener('scroll', save, { passive: true });
    window.addEventListener('beforeunload', save);
    return () => {
      save();
      window.removeEventListener('scroll', save);
      window.removeEventListener('beforeunload', save);
    };
  }, [pathname]);

  return null;
}
