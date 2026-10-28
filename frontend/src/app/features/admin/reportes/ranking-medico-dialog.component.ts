import { DecimalPipe } from '@angular/common';
import { AfterViewInit, Component, ElementRef, inject, OnDestroy, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import Chart from 'chart.js/auto';

import { RankingMedico } from '../../../core/models/reporte.model';

@Component({
  selector: 'app-ranking-medico-dialog',
  standalone: true,
  imports: [DecimalPipe, MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './ranking-medico-dialog.component.html',
  styleUrl: './ranking-medico-dialog.component.css'
})
export class RankingMedicoDialogComponent implements AfterViewInit, OnDestroy {
  @ViewChild('rankingCanvas') private rankingCanvas?: ElementRef<HTMLCanvasElement>;

  readonly ranking = inject<RankingMedico[]>(MAT_DIALOG_DATA);
  readonly alturaGrafico = Math.max(280, this.ranking.length * 44 + 60);
  private graficoRanking?: Chart;

  ngAfterViewInit(): void {
    if (!this.rankingCanvas) return;

    this.graficoRanking = new Chart(this.rankingCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: this.ranking.map((medico) => medico.nombreCompleto),
        datasets: [
          {
            label: 'Turnos atendidos',
            data: this.ranking.map((medico) => medico.turnosAtendidos),
            backgroundColor: '#237253',
            borderRadius: 5,
            barThickness: 24
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { precision: 0 }
          }
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.graficoRanking?.destroy();
  }
}
