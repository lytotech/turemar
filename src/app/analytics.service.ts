import { Injectable } from '@angular/core';

/** Type-safe interface for gtag calls */
declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

/**
 * Serviço centralizado de Analytics (Google Analytics 4 - GA4)
 *
 * Rastreia como o usuário acessa e interage com o site:
 * - Origem do tráfego (UTM params, referrer, acesso direto)
 * - Navegação entre seções
 * - Cliques em CTAs (botões, links, WhatsApp)
 * - Interações com o formulário de contato
 * - Scroll depth (quanto da página o usuário vê)
 * - Tempo de engajamento por seção
 * - Dispositivo e viewport
 */
@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private readonly GA_ID = 'G-9ZWBSHE66M';
  private sectionsViewed = new Set<string>();
  private sectionTimers = new Map<string, number>();
  private scrollMilestones = new Set<number>();
  private initialized = false;

  /**
   * Inicializa o tracking completo do Analytics.
   * Deve ser chamado no AfterViewInit do AppComponent.
   */
  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.trackTrafficSource();
    this.trackDeviceInfo();
    this.trackSectionVisibility();
    this.trackScrollDepth();
    this.trackOutboundLinks();
    this.trackNavClicks();
    this.trackCTAClicks();
    this.trackTimeOnPage();
  }

  // ──────────────────────────────────────────────
  // 1. ORIGEM DO TRÁFEGO
  // ──────────────────────────────────────────────

  /** Identifica de onde o usuário veio (UTM, referrer, direto, orgânico) */
  private trackTrafficSource(): void {
    const params = new URLSearchParams(window.location.search);
    const referrer = document.referrer;

    const utmSource = params.get('utm_source');
    const utmMedium = params.get('utm_medium');
    const utmCampaign = params.get('utm_campaign');
    const utmTerm = params.get('utm_term');
    const utmContent = params.get('utm_content');

    // Determina o tipo de acesso
    let accessType: string;
    if (utmSource) {
      accessType = 'campaign';
    } else if (!referrer) {
      accessType = 'direct';
    } else if (referrer.includes('google') || referrer.includes('bing') || referrer.includes('yahoo')) {
      accessType = 'organic_search';
    } else if (referrer.includes('facebook') || referrer.includes('instagram') ||
               referrer.includes('twitter') || referrer.includes('linkedin') ||
               referrer.includes('tiktok') || referrer.includes('youtube')) {
      accessType = 'social';
    } else {
      accessType = 'referral';
    }

    this.sendEvent('traffic_source_identified', {
      access_type: accessType,
      referrer_url: referrer || 'direct',
      utm_source: utmSource || '(not set)',
      utm_medium: utmMedium || '(not set)',
      utm_campaign: utmCampaign || '(not set)',
      utm_term: utmTerm || '(not set)',
      utm_content: utmContent || '(not set)',
      landing_page: window.location.pathname + window.location.hash,
    });

    // Evento específico para campanhas UTM
    if (utmSource) {
      this.sendEvent('utm_campaign_visit', {
        campaign_source: utmSource,
        campaign_medium: utmMedium || '(not set)',
        campaign_name: utmCampaign || '(not set)',
        campaign_term: utmTerm || '(not set)',
        campaign_content: utmContent || '(not set)',
      });
    }

    // Evento para social referrals
    if (accessType === 'social') {
      const socialNetwork = this.identifySocialNetwork(referrer);
      this.sendEvent('social_referral', {
        social_network: socialNetwork,
        referrer_url: referrer,
      });
    }
  }

  /** Identifica a rede social de origem */
  private identifySocialNetwork(referrer: string): string {
    const networks: Record<string, string> = {
      'facebook': 'Facebook',
      'instagram': 'Instagram',
      'twitter': 'Twitter/X',
      'linkedin': 'LinkedIn',
      'tiktok': 'TikTok',
      'youtube': 'YouTube',
      'pinterest': 'Pinterest',
      'whatsapp': 'WhatsApp',
    };

    for (const [key, name] of Object.entries(networks)) {
      if (referrer.includes(key)) return name;
    }
    return 'other';
  }

  // ──────────────────────────────────────────────
  // 2. INFORMAÇÕES DO DISPOSITIVO
  // ──────────────────────────────────────────────

  /** Rastreia tipo de dispositivo, viewport e conexão */
  private trackDeviceInfo(): void {
    const width = window.innerWidth;
    let deviceType: string;
    if (width < 768) {
      deviceType = 'mobile';
    } else if (width < 1024) {
      deviceType = 'tablet';
    } else {
      deviceType = 'desktop';
    }

    const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;

    this.sendEvent('device_info', {
      device_type: deviceType,
      viewport_width: width,
      viewport_height: window.innerHeight,
      screen_width: screen.width,
      screen_height: screen.height,
      pixel_ratio: window.devicePixelRatio,
      connection_type: connection?.effectiveType || 'unknown',
      language: navigator.language,
      platform: navigator.platform,
    });
  }

  // ──────────────────────────────────────────────
  // 3. VISIBILIDADE DE SEÇÕES
  // ──────────────────────────────────────────────

  /** Rastreia quais seções o usuário visualizou e quanto tempo ficou em cada uma */
  private trackSectionVisibility(): void {
    const sections = ['inicio', 'sobre', 'servicos', 'contato'];

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const sectionId = entry.target.id;

          if (entry.isIntersecting) {
            // Seção entrou na viewport
            if (!this.sectionsViewed.has(sectionId)) {
              this.sectionsViewed.add(sectionId);
              this.sendEvent('section_view', {
                section_name: sectionId,
                section_index: sections.indexOf(sectionId),
                is_first_view: true,
              });
            }

            // Inicia timer de tempo na seção
            this.sectionTimers.set(sectionId, Date.now());

          } else if (this.sectionTimers.has(sectionId)) {
            // Seção saiu da viewport — calcula tempo
            const startTime = this.sectionTimers.get(sectionId)!;
            const timeSpent = Math.round((Date.now() - startTime) / 1000);

            if (timeSpent > 1) {
              this.sendEvent('section_engagement', {
                section_name: sectionId,
                time_spent_seconds: timeSpent,
              });
            }
            this.sectionTimers.delete(sectionId);
          }
        });
      },
      { threshold: 0.3 }
    );

    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
  }

  // ──────────────────────────────────────────────
  // 4. SCROLL DEPTH
  // ──────────────────────────────────────────────

  /** Rastreia o quão longe o usuário desceu na página (25%, 50%, 75%, 100%) */
  private trackScrollDepth(): void {
    const milestones = [25, 50, 75, 90, 100];

    const handler = (): void => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;

      const scrollPercent = Math.round((scrollTop / docHeight) * 100);

      milestones.forEach((milestone) => {
        if (scrollPercent >= milestone && !this.scrollMilestones.has(milestone)) {
          this.scrollMilestones.add(milestone);
          this.sendEvent('scroll_depth', {
            percent_scrolled: milestone,
            pixel_depth: scrollTop,
          });
        }
      });
    };

    window.addEventListener('scroll', handler, { passive: true });
  }

  // ──────────────────────────────────────────────
  // 5. CLIQUES EM LINKS EXTERNOS (WhatsApp, redes, etc.)
  // ──────────────────────────────────────────────

  /** Rastreia todos os cliques em links que abrem em nova aba */
  private trackOutboundLinks(): void {
    document.addEventListener('click', (event) => {
      const link = (event.target as HTMLElement).closest('a');
      if (!link) return;

      const href = link.getAttribute('href');
      if (!href) return;

      // WhatsApp
      if (href.includes('wa.me') || href.includes('whatsapp')) {
        const location = this.getClickLocation(link);
        this.sendEvent('whatsapp_click', {
          click_location: location,
          link_url: href,
          link_text: link.textContent?.trim() || '',
        });
      }

      // Telefone
      if (href.startsWith('tel:')) {
        this.sendEvent('phone_click', {
          phone_number: href.replace('tel:', ''),
          click_location: this.getClickLocation(link),
        });
      }

      // E-mail
      if (href.startsWith('mailto:')) {
        this.sendEvent('email_click', {
          email_address: href.replace('mailto:', ''),
          click_location: this.getClickLocation(link),
        });
      }

      // Link externo genérico
      if (href.startsWith('http') && !href.includes(window.location.hostname)) {
        this.sendEvent('outbound_link_click', {
          link_url: href,
          link_text: link.textContent?.trim() || '',
          click_location: this.getClickLocation(link),
        });
      }
    });
  }

  // ──────────────────────────────────────────────
  // 6. NAVEGAÇÃO INTERNA
  // ──────────────────────────────────────────────

  /** Rastreia cliques no menu de navegação */
  private trackNavClicks(): void {
    document.addEventListener('click', (event) => {
      const link = (event.target as HTMLElement).closest('a');
      if (!link) return;

      const href = link.getAttribute('href');
      if (!href || !href.startsWith('#')) return;

      const isMenuClick = !!link.closest('.nav-menu, .mobile-menu, .footer-links');

      if (isMenuClick) {
        this.sendEvent('navigation_click', {
          target_section: href.replace('#', ''),
          nav_type: link.closest('.mobile-menu') ? 'mobile_menu' : (link.closest('.footer-links') ? 'footer' : 'desktop_menu'),
          link_text: link.textContent?.trim() || '',
        });
      }
    });
  }

  // ──────────────────────────────────────────────
  // 7. CLIQUES EM CTAs (Call-to-Action)
  // ──────────────────────────────────────────────

  /** Rastreia cliques em botões de ação */
  private trackCTAClicks(): void {
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const button = target.closest('.btn, button');
      if (!button) return;

      const isLink = button.tagName === 'A';
      const href = isLink ? button.getAttribute('href') : null;

      this.sendEvent('cta_click', {
        cta_text: button.textContent?.trim() || '',
        cta_type: button.classList.contains('btn-primary') ? 'primary' : 'secondary',
        cta_location: this.getClickLocation(button),
        cta_href: href || 'form_submit',
      });
    });
  }

  // ──────────────────────────────────────────────
  // 8. FORMULÁRIO DE CONTATO
  // ──────────────────────────────────────────────

  /** Rastreia interações com o formulário de contato */
  trackFormStart(): void {
    this.sendEvent('form_start', {
      form_name: 'contact_form',
      form_location: 'contato_section',
    });
  }

  /** Rastreia envio do formulário via WhatsApp */
  trackFormSubmit(servico: string): void {
    this.sendEvent('form_submit', {
      form_name: 'contact_form',
      service_selected: servico,
      form_destination: 'whatsapp',
    });

    // Evento de conversão
    this.sendEvent('generate_lead', {
      currency: 'BRL',
      value: 1,
      lead_source: 'website_form',
      service_interest: servico,
    });
  }

  /** Rastreia interação com campos do formulário */
  trackFormFieldInteraction(fieldName: string): void {
    this.sendEvent('form_field_interaction', {
      form_name: 'contact_form',
      field_name: fieldName,
    });
  }

  // ──────────────────────────────────────────────
  // 9. TEMPO NA PÁGINA
  // ──────────────────────────────────────────────

  /** Rastreia quanto tempo o usuário ficou no site antes de sair */
  private trackTimeOnPage(): void {
    const startTime = Date.now();

    // Envia a cada 30s (para não perder dados se o usuário fechar a aba)
    const intervals = [30, 60, 120, 300]; // 30s, 1min, 2min, 5min
    const firedIntervals = new Set<number>();

    setInterval(() => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      intervals.forEach((interval) => {
        if (elapsed >= interval && !firedIntervals.has(interval)) {
          firedIntervals.add(interval);
          this.sendEvent('time_on_page_milestone', {
            seconds_on_page: interval,
          });
        }
      });
    }, 5000);

    // Envia tempo total ao sair da página
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        const totalTime = Math.round((Date.now() - startTime) / 1000);
        this.sendEvent('page_exit', {
          total_time_seconds: totalTime,
          sections_viewed: Array.from(this.sectionsViewed).join(','),
          max_scroll: Math.max(...Array.from(this.scrollMilestones), 0),
        });
      }
    });
  }

  // ──────────────────────────────────────────────
  // HELPERS
  // ──────────────────────────────────────────────

  /** Identifica em qual seção/área do site o clique ocorreu */
  private getClickLocation(element: Element): string {
    const section = element.closest('section, header, footer');
    if (!section) return 'unknown';

    if (section.tagName === 'HEADER') return 'header';
    if (section.tagName === 'FOOTER') return 'footer';
    return section.id || 'unknown';
  }

  /** Envia evento customizado para o GA4 */
  private sendEvent(eventName: string, params: Record<string, unknown> = {}): void {
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, {
        ...params,
        send_to: this.GA_ID,
      });
    }
  }
}
