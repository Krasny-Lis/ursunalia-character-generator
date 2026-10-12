import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EVENT_CONFIG } from '../../../../core/config/event.config';

@Component({
  selector:'app-home-page',
  standalone:true,
  imports:[RouterLink],
  templateUrl:'./home-page.html',
  styleUrl:'./home-page.scss',
})
export class HomePage {
  protected readonly event = EVENT_CONFIG;
}
