import { Component, AfterViewInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AnalyticsService } from './analytics.service';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, FormsModule, CommonModule],
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss']
})
export class AppComponent implements AfterViewInit {
  private readonly analytics = inject(AnalyticsService);

  title = 'turemar';
  mobileMenuOpen = false;
  private formStarted = false;

  // Form fields
  nome = '';
  email = '';
  telefone = '';
  servico = '';
  mensagem = '';

  ngAfterViewInit(): void {
    this.initScrollReveal();
    this.analytics.initialize();
  }

  toggleMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMenu(): void {
    this.mobileMenuOpen = false;
  }

  /** Chamado quando o usuário começa a preencher o formulário */
  onFormFieldFocus(fieldName: string): void {
    if (!this.formStarted) {
      this.formStarted = true;
      this.analytics.trackFormStart();
    }
    this.analytics.trackFormFieldInteraction(fieldName);
  }

  enviarWhatsApp(): void {
    // Rastreia envio do formulário no GA4
    this.analytics.trackFormSubmit(this.servico);

    const servicoLabels: { [key: string]: string } = {
      'cruzeiro': 'Cruzeiro',
      'aereo': 'Passagem Aérea',
      'terrestre': 'Viagem Terrestre',
      'pacote': 'Pacote Completo',
      'hotel': 'Hospedagem'
    };

    let msg = `Olá! Gostaria de mais informações.\n\n`;
    msg += `*Nome:* ${this.nome}\n`;
    msg += `*E-mail:* ${this.email}\n`;
    if (this.telefone) {
      msg += `*Telefone:* ${this.telefone}\n`;
    }
    msg += `*Serviço:* ${servicoLabels[this.servico] || this.servico}\n`;
    if (this.mensagem) {
      msg += `*Mensagem:* ${this.mensagem}\n`;
    }

    const url = `https://wa.me/5541987822306?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }

  private initScrollReveal(): void {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
  }
}
