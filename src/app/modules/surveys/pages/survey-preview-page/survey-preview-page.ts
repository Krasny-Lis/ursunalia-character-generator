import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DEMO_SURVEY } from '../../data/demo-survey';
import { SurveyRenderer } from '../../renderer/survey-renderer';

@Component({
  selector: 'app-survey-preview-page',
  standalone: true,
  imports: [RouterLink, SurveyRenderer],
  templateUrl: './survey-preview-page.html',
  styleUrl: './survey-preview-page.scss',
})
export class SurveyPreviewPage {
  protected readonly survey = DEMO_SURVEY;
}
