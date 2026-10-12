import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Tylko development; nie wymaga ani nie udaje rzeczywistych uprawnień. */
@Component({
  selector:'app-surveys-dev-page',
  standalone:true,
  imports:[RouterLink],
  templateUrl:'./surveys-dev-page.html',
  styleUrl:'./surveys-dev-page.scss',
})
export class SurveysDevPage {}
