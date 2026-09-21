export type WhatsAppLang = 'en' | 'rw' | 'fr';

export function normalizeWhatsAppLang(lang?: string | null): WhatsAppLang {
  if (!lang) {
    return 'en';
  }
  const value = lang.toLowerCase().trim();
  if (value.startsWith('rw') || value.includes('kinya')) {
    return 'rw';
  }
  if (value.startsWith('fr')) {
    return 'fr';
  }
  return 'en';
}

function formatWhen(iso: string | undefined, lang: WhatsAppLang): string {
  if (!iso) {
    return lang === 'rw' ? 'vuba' : lang === 'fr' ? 'bientôt' : 'soon';
  }
  try {
    return new Date(iso).toLocaleString(lang === 'rw' ? 'rw-RW' : lang === 'fr' ? 'fr-FR' : 'en-RW', {
      timeZone: 'Africa/Kigali',
    });
  } catch {
    return iso;
  }
}

export const WhatsAppCopy = {
  emptyText(lang: WhatsAppLang): string {
    if (lang === 'rw') {
      return 'Nyandikira aho bazakugufata n’aho ugiye (urugero: Kuva Remera kugera Nyabugogo).';
    }
    if (lang === 'fr') {
      return 'Envoyez le départ et la destination (ex. De Remera à Nyabugogo).';
    }
    return 'Please send your pickup and destination as text.';
  },

  greeting(lang: WhatsAppLang): string {
    if (lang === 'rw') {
      return 'Muraho! Andika icyifuzo cyawe nka: Kuva Kimironko kugera Kacyiru saa cyenda.';
    }
    if (lang === 'fr') {
      return 'Bonjour ! Envoyez une demande comme : De Kimironko à Kacyiru à 15h.';
    }
    return 'Hello! Send a transport request like: From Kimironko to Kacyiru at 3pm';
  },

  help(lang: WhatsAppLang): string {
    if (lang === 'rw') {
      return 'Nshobora kugufasha gusaba moto. Urugero: Kuva Remera kugera Nyabugogo. Urashobora no kohereza aho uri.';
    }
    if (lang === 'fr') {
      return 'Je peux réserver une moto. Exemple : De Remera à Nyabugogo. Vous pouvez aussi partager votre position.';
    }
    return 'I can book motorcycle transport. Example: From Remera to Nyabugogo. You can also share your pickup location.';
  },

  clarify(lang: WhatsAppLang, missing: string): string {
    if (lang === 'rw') {
      return `Wongere ubisobanure neza. Bibura: ${missing}. Urugero: Kuva Kimironko kugera Kacyiru`;
    }
    if (lang === 'fr') {
      return `Pouvez-vous préciser ? Manque : ${missing}. Exemple : De Kimironko à Kacyiru`;
    }
    return `Could you clarify your trip? Missing: ${missing}. Example: From Kimironko to Kacyiru`;
  },

  notUnderstood(lang: WhatsAppLang): string {
    if (lang === 'rw') {
      return 'Sinumvise neza. Gerageza: Kuva [aho ugiye gufatwa] kugera [aho ugiye]';
    }
    if (lang === 'fr') {
      return 'Je n’ai pas compris. Essayez : De [départ] à [destination]';
    }
    return 'I could not understand that. Try: From [pickup] to [destination]';
  },

  cancelled(lang: WhatsAppLang): string {
    if (lang === 'rw') {
      return 'Byahagaritswe. Ongera wohereze aho bazakugufata n’aho ugiye igihe witeguye.';
    }
    if (lang === 'fr') {
      return 'Annulé. Renvoyez départ et destination quand vous voulez.';
    }
    return 'Cancelled. Send a new pickup and destination when ready.';
  },

  draftCancelled(lang: WhatsAppLang): string {
    if (lang === 'rw') {
      return 'Icyifuzo cyawe cyahagaritswe.';
    }
    if (lang === 'fr') {
      return 'Votre brouillon a été annulé.';
    }
    return 'Your draft request was cancelled.';
  },

  placeNotFound(lang: WhatsAppLang, side: 'pickup' | 'destination', query: string): string {
    if (lang === 'rw') {
      return side === 'pickup'
        ? `Sinabonye "${query}". Ongera wandike aho bazakugufata.`
        : `Sinabonye "${query}". Ongera wandike aho ugiye.`;
    }
    if (lang === 'fr') {
      return side === 'pickup'
        ? `Je n’ai pas trouvé « ${query} ». Réécrivez le lieu de prise en charge.`
        : `Je n’ai pas trouvé « ${query} ». Réécrivez la destination.`;
    }
    return side === 'pickup'
      ? `I could not find "${query}". Please rewrite the pickup location.`
      : `I could not find "${query}". Please rewrite the destination.`;
  },

  askPickup(lang: WhatsAppLang): string {
    if (lang === 'rw') return 'Bazakugufata he?';
    if (lang === 'fr') return 'Où devons-nous vous prendre ?';
    return 'Where should we pick you up?';
  },

  askDestination(lang: WhatsAppLang): string {
    if (lang === 'rw') return 'Ugiye he?';
    if (lang === 'fr') return 'Quelle est votre destination ?';
    return 'Where is your destination?';
  },

  confirmTrip(
    lang: WhatsAppLang,
    pickup: string,
    dest: string,
    whenIso: string | undefined,
    cutoffLabel: string | null,
  ): string {
    const when = formatWhen(whenIso, lang);
    let body: string;
    if (lang === 'rw') {
      body = `Emeza urugendo:\n${pickup} → ${dest}\nIgihe: ${when}`;
    } else if (lang === 'fr') {
      body = `Confirmer le trajet :\n${pickup} → ${dest}\nHeure : ${when}`;
    } else {
      body = `Confirm trip:\n${pickup} → ${dest}\nTime: ${when}`;
    }
    if (cutoffLabel) {
      body += `\n\n${cutoffLabel}`;
    }
    return body;
  },

  pickupChangeAllowedUntil(lang: WhatsAppLang, cutoffIso: string): string {
    const when = formatWhen(cutoffIso, lang);
    if (lang === 'rw') {
      return `Wemerewe guhindura aho bari buze kugufata mbere y’iki gihe: ${when}.`;
    }
    if (lang === 'fr') {
      return `Vous pouvez modifier le lieu de prise en charge avant : ${when}.`;
    }
    return `You may change your pickup location before: ${when}.`;
  },

  pickupChangeLocked(lang: WhatsAppLang, cutoffIso: string): string {
    const when = formatWhen(cutoffIso, lang);
    if (lang === 'rw') {
      return `Ntabwo ushobora guhindura aho bazakugufata. Igihe cyo guhindura cyarangiye (${when}). Urashobora guhindura aho ugiye gusa cyangwa uhagarike icyifuzo.`;
    }
    if (lang === 'fr') {
      return `Vous ne pouvez plus modifier le lieu de prise en charge (délai dépassé : ${when}). Vous pouvez encore changer la destination ou annuler.`;
    }
    return `You can no longer change the pickup location (deadline was ${when}). You may still change the destination or cancel.`;
  },

  askTripUpdate(
    lang: WhatsAppLang,
    currentPickup: string,
    currentDest: string,
    newPickup: string,
    newDest: string,
    pickupChanged: boolean,
    destChanged: boolean,
    cutoffLabel: string | null,
  ): string {
    const changeBits: string[] = [];
    if (lang === 'rw') {
      if (pickupChanged) {
        changeBits.push(`aho bazakugufata: ${currentPickup} → ${newPickup}`);
      }
      if (destChanged) {
        changeBits.push(`aho ugiye: ${currentDest} → ${newDest}`);
      }
      let body = `Ufite icyifuzo gishya.\nUbu: ${currentPickup} → ${currentDest}\nHashya: ${newPickup} → ${newDest}\n\nUrashaka guhindura (${changeBits.join('; ')})?`;
      if (cutoffLabel) body += `\n\n${cutoffLabel}`;
      return body;
    }
    if (lang === 'fr') {
      if (pickupChanged) changeBits.push(`prise en charge : ${currentPickup} → ${newPickup}`);
      if (destChanged) changeBits.push(`destination : ${currentDest} → ${newDest}`);
      let body = `Nouvelle demande détectée.\nActuel : ${currentPickup} → ${currentDest}\nNouveau : ${newPickup} → ${newDest}\n\nVoulez-vous mettre à jour (${changeBits.join('; ')}) ?`;
      if (cutoffLabel) body += `\n\n${cutoffLabel}`;
      return body;
    }
    if (pickupChanged) changeBits.push(`pickup: ${currentPickup} → ${newPickup}`);
    if (destChanged) changeBits.push(`destination: ${currentDest} → ${newDest}`);
    let body = `I noticed a different trip.\nCurrent: ${currentPickup} → ${currentDest}\nNew: ${newPickup} → ${newDest}\n\nDo you want to update your ${changeBits.join(' and ')}?`;
    if (cutoffLabel) body += `\n\n${cutoffLabel}`;
    return body;
  },

  keepingCurrentTrip(lang: WhatsAppLang): string {
    if (lang === 'rw') return 'Turagumana icyifuzo cy’ubu. Emeza cyangwa uhagarike.';
    if (lang === 'fr') return 'Nous gardons le trajet actuel. Confirmez ou annulez.';
    return 'Keeping your current trip. Please confirm or cancel.';
  },

  aiUnavailable(lang: WhatsAppLang): string {
    if (lang === 'rw') {
      return 'Serivisi y’ubwenge bw’ubwoba ntabwo yateguwe. Ongera ugerageze vuba cyangwa uhame umuyobozi.';
    }
    if (lang === 'fr') {
      return 'Le service d’IA n’est pas configuré. Réessayez plus tard ou contactez l’administrateur.';
    }
    return 'AI parsing is not configured. Please try again later or contact your admin.';
  },

  updateButtonYes(lang: WhatsAppLang): string {
    if (lang === 'rw') return 'Hindura';
    if (lang === 'fr') return 'Modifier';
    return 'Update';
  },

  updateButtonNo(lang: WhatsAppLang): string {
    if (lang === 'rw') return 'Rekana';
    if (lang === 'fr') return 'Garder';
    return 'Keep';
  },

  confirmButtonYes(lang: WhatsAppLang): string {
    if (lang === 'rw') return 'Emeza';
    if (lang === 'fr') return 'Confirmer';
    return 'Confirm';
  },

  confirmButtonNo(lang: WhatsAppLang): string {
    if (lang === 'rw') return 'Hagarika';
    if (lang === 'fr') return 'Annuler';
    return 'Cancel';
  },

  submitted(lang: WhatsAppLang, pickup: string, dest: string): string {
    if (lang === 'rw') {
      return `Icyifuzo cyoherejwe ku muyobozi (${pickup} → ${dest}).`;
    }
    if (lang === 'fr') {
      return `Demande envoyée pour approbation (${pickup} → ${dest}).`;
    }
    return `Request submitted for supervisor approval (${pickup} → ${dest}).`;
  },
};

/** Minutes before requested pickup when changing pickup is still allowed. */
export function pickupChangeDeadline(
  requestedPickupTime: string | undefined,
  minutesBefore: number,
): Date | null {
  if (!requestedPickupTime || !Number.isFinite(minutesBefore) || minutesBefore < 0) {
    return null;
  }
  const pickupAt = new Date(requestedPickupTime);
  if (Number.isNaN(pickupAt.getTime())) {
    return null;
  }
  return new Date(pickupAt.getTime() - minutesBefore * 60_000);
}

export function canChangePickup(deadline: Date | null, now = new Date()): boolean {
  if (!deadline) {
    return true;
  }
  return now.getTime() < deadline.getTime();
}

export function normalizePlaceKey(value?: string | null): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
