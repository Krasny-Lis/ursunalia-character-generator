import type { ModuleDefinition } from '../modules/module-definition';

/**
 * Konfiguracja modułów na v24. Wyłączenie blokuje trasę oraz ukrywa link.
 * Moduły organizatora są wyłącznie lokalnymi szkicami, nie produkcyjnym dostępem.
 */
export const FEATURE_MODULES: readonly ModuleDefinition[] = [
  { id:'event', label:'Wydarzenie', path:'/', enabled:true, access:'public', navigationGroup:'public', permissions:[] },
  { id:'character', label:'Zgłoszenie postaci', path:'/zgloszenie-postaci', enabled:true, access:'public', navigationGroup:'public', permissions:[] },
  { id:'surveys', label:'Ankiety (dev)', path:'/organizator/ankiety', enabled:true, access:'development', navigationGroup:'developer', permissions:['surveys.edit'] },
  { id:'player', label:'Mój panel', path:'/panel', enabled:false, access:'development', navigationGroup:'player', permissions:['profile.read'] },
  { id:'organizer', label:'Organizator', path:'/organizator', enabled:false, access:'development', navigationGroup:'organizer', permissions:['submissions.read'] },
  { id:'admin', label:'Administracja', path:'/administracja', enabled:false, access:'development', navigationGroup:'admin', permissions:['modules.manage'] },
  { id:'announcements', label:'Ogłoszenia', path:'/ogloszenia', enabled:false, access:'public', navigationGroup:'public', permissions:[] },
  { id:'knowledge', label:'Kompendium', path:'/kompendium', enabled:false, access:'public', navigationGroup:'public', permissions:[] },
  { id:'gallery', label:'Galeria postaci', path:'/galeria', enabled:false, access:'public', navigationGroup:'public', permissions:[] },
  { id:'mailing', label:'Mailing', path:'/organizator/mail', enabled:false, access:'development', navigationGroup:'organizer', permissions:['mailing.send'] },
  { id:'story', label:'Wątki', path:'/organizator/watki', enabled:false, access:'development', navigationGroup:'organizer', permissions:['story.edit'] },
];
