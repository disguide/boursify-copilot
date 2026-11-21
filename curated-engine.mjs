/**
 * Curated SBG 2026 Handbook Strategy Engine (Zero API Key / <2ms Execution)
 * Built directly from the 18-page Grasset Stock Market Simulation 2026 Participant Handbook.
 */

export const analyzeCurated = ({ headline = '', portfolio = {} }) => {
  const raw = String(headline || '').trim();
  const t = raw.toLowerCase();
  const holdings = portfolio.holdings || {};
  const actions = [];

  const addAction = (ticker, rawAction, conviction, target_pct, reason) => {
    if (actions.some((a) => a.ticker === ticker)) return;
    const heldQty = Number(holdings[ticker]?.qty || 0);
    let action = rawAction;
    let pct = target_pct;

    if (rawAction === 'BEAR') {
      if (heldQty > 0) {
        action = 'SELL';
        pct = 100;
      } else {
        action = conviction >= 2 ? 'SHORT' : 'AVOID';
        pct = conviction >= 3 ? 22 : conviction === 2 ? 14 : 0;
      }
    } else if (rawAction === 'BULL') {
      if (heldQty < 0) {
        action = 'COVER';
        pct = 100;
      } else {
        action = 'BUY';
        pct = conviction >= 3 ? 28 : 18;
      }
    }

    actions.push({ ticker, action, conviction, target_pct: pct, reason });
  };

  const hasAny = (words) => words.some((w) => t.includes(w));

  // --- Sentiment polarity helpers (negation-aware, bilingual EN/FR) ---
  const NEG_CUES = [
    'delay', 'delays', 'delaying', 'delayed', 'retard', 'provision', 'recession', 'récession',
    'short position', 'positions à découvert', 'vente à découvert', 'short seller',
    'cut', 'cuts', 'cutting', 'baisse', 'chute', 'plunge', 'drop', 'drops', 'slump', 'decline',
    'lawsuit', 'poursuite', 'fine', 'fined', 'amende', 'inquiry', 'enquête', 'scandal', 'scandale',
    'overrun', 'dépassement', 'default', 'défaut', 'covenant', 'debt concern', 'endettement',
    'patent expir', 'expiration du brevet', 'generic', 'générique', 'fail', 'fails', 'failed', 'échec', 'échoue',
    'reject', 'rejet', 'side effect', 'effet secondaire', 'suspend', 'halt', 'blockade', 'blocus',
    'tariff', 'tarif', 'douane', 'royalt', 'redevance', 'tighten', 'resserre', 'review the subsid',
    'minimum wage', 'salaire minimum', 'strike', 'grève', 'shortage', 'pénurie', 'unprofitable',
    'loss', 'perte', 'deficit', 'déficit', 'doubt', 'doute', 'bubble', 'bulle', 'overvalued', 'surévalué',
    'lock-up', 'blocage', 'sell its stake', 'vend sa participation', 'dump', 'downgrade', 'abaisse',
    'Financing needed', 'new financing', 'financement', 'dilution', 'ethics', 'éthique', 'ngo', 'ong',
    'working conditions', 'conditions de travail', ' directive', 'inflation',
  ];

  const POS_CUES = [
    'approval', 'approved', 'approuvé', 'homologation', 'success', 'succès', 'positive result', 'résultats positifs',
    'breakthrough', 'percée', 'beat', 'beats', 'dépasse', 'record profit', 'record revenue', 'bénéfice record',
    'contract', 'contrat', 'wins', 'remporte', 'signed', 'signe', 'agreement', 'entente', 'accord',
    'partnership', 'partenariat', 'subsid', 'subvention', 'fund for green', 'fonds de 2',
    'tax cut', 'baisse d\'impôt', 'lighter regulation', 'allègement', 'revive development', 'relance',
    'raise defence', 'raising their defence', 'hausse des budgets de défense', '3.5% of gdp', '3,5 % du pib',
    'modernize', 'modernisation', 'expansion', 'upgrade', 'relève', 'buyback', 'rachat d\'actions',
    'dividend increase', 'hausse du dividende', 'acquisition', 'buyout', 'rachat', 'ahead of schedule',
    'en avance', 'cut unsold stock', 'réduit les stocks invendus', 'growth', 'croissance', 'surge', 'bondit',
    'goes public', 'entrée en bourse', 'rings the opening bell', 'cloche d\'ouverture',
  ];

  let negScore = 0;
  let posScore = 0;
  for (const w of NEG_CUES) if (t.includes(w)) negScore++;
  for (const w of POS_CUES) if (t.includes(w)) posScore++;

  // "records a ... provision / loss" should never count as positive
  if (hasAny(['provision', 'loss', 'perte', 'deficit', 'déficit', 'delay', 'retard'])) {
    negScore += 2;
  }

  // =========================================================================
  // 1. MULTI-TICKER MACRO & POLITICAL SCENARIOS (Handbook Page 5 & Profiles)
  // =========================================================================

  // A. Quebec Election: Québec Ensemble (Camille Fortin) vs Alliance prospérité (Jean-Philippe Ouellet)
  const mentionsQE = hasAny(['québec ensemble', 'quebec ensemble', 'camille fortin']);
  const mentionsAPQ = hasAny(['alliance prospérité', 'alliance prosperite', 'jean-philippe ouellet', 'ouellet']);

  if (mentionsQE && !mentionsAPQ) {
    const qeWinning = !hasAny(['trail', 'lose', 'loses', 'defeat', 'behind', 'perd', 'recul']);
    if (qeWinning) {
      addAction('LIA', 'BULL', 3, 28, 'Québec Ensemble backs $2B green hydrogen fund & cheap power');
      addAction('TAG', 'BEAR', 3, 20, 'Québec Ensemble reviews $600M subsidies & hikes mining royalties');
      addAction('CHA', 'BEAR', 2, 15, 'Québec Ensemble promises inquiry into grocers’ margins');
    } else {
      addAction('TAG', 'BULL', 2, 20, 'Québec Ensemble setback lowers Taïga royalty/subsidy risk');
      addAction('LIA', 'BEAR', 2, 15, 'Québec Ensemble setback threatens $2B green H2 fund');
    }
  }

  if (mentionsAPQ && !mentionsQE) {
    const apqWinning = !hasAny(['trail', 'lose', 'loses', 'defeat', 'behind', 'perd', 'recul']);
    if (apqWinning) {
      addAction('TAG', 'BULL', 3, 28, 'Alliance prospérité backs Far North mining & $600M Aurore subsidy');
      addAction('NOR', 'BULL', 2, 18, 'Alliance prospérité revives $1.1B Far North Highway & development');
      addAction('LIA', 'BEAR', 2, 15, 'Alliance prospérité win shelves $2B green hydrogen fund');
    } else {
      addAction('LIA', 'BULL', 2, 18, 'Alliance prospérité setback boosts Québec Ensemble green H2 odds');
      addAction('TAG', 'BEAR', 2, 15, 'Alliance prospérité setback raises Aurore political risk');
    }
  }

  // B. Central Bank Interest Rates (Bank of Canada / Federal Reserve)
  if (hasAny(['bank of canada', 'banque du canada', 'federal reserve', 'réserve fédérale', 'policy rate', 'taux directeur', 'interest rate', 'taux d\'intérêt'])) {
    if (hasAny(['rate cut', 'cuts rate', 'cut its', 'lower rate', 'baisse de taux', 'abaisse son taux', 'réduit son taux'])) {
      addAction('PAL', 'BEAR', 3, 20, 'Rate cut squeezes Palissade Capital net interest margin');
      addAction('NOR', 'BULL', 2, 18, 'Lower rates ease Northline 1.5x debt & stimulate construction');
      addAction('LIA', 'BULL', 2, 15, 'Lower rates ease Hydrélia $1.2B Bécancour plant financing');
    } else if (hasAny(['rate hike', 'raises rate', 'higher rate', 'hausse de taux', 'relève son taux', 'holds its policy rate', 'maintient son taux'])) {
      addAction('PAL', 'BULL', 2, 18, 'High 4.25%+ interest rates boost Palissade lending spread');
      addAction('PIN', 'BEAR', 2, 14, 'High rates pressure Papineau 3.6x debt near 4.0x covenant');
    }
  }

  // C. Taiwan Strait / Indo-Pacific / Semiconductor Supply
  if (hasAny(['taiwan', 'taïwan', 'indo-pacific', 'indo-pacifique', 'strait', 'détroit'])) {
    if (hasAny(['tension', 'military', 'militaire', 'manoeuvr', 'manœuvr', 'blockade', 'blocus', 'conflict', 'conflit', 'crisis', 'crise', 'disrupt', 'shortage', 'pénurie'])) {
      addAction('HAW', 'BULL', 3, 28, 'Indo-Pacific/Taiwan military tensions boost Grayhawk defence orders');
      addAction('RAI', 'BEAR', 3, 20, 'Taiwan Strait disruption threatens Rubicon AI chip supply');
      addAction('HOL', 'BEAR', 2, 14, 'Taiwan/Asian supply chain disruption hurts Hollis & Rowe');
    } else if (hasAny(['peace', 'de-escalat', 'apaisement', 'accord', 'treaty'])) {
      addAction('RAI', 'BULL', 2, 20, 'Taiwan de-escalation secures Rubicon AI chip supply');
    }
  }

  // D. NATO / Military Base Modernization / Defence Spending
  if (hasAny(['nato', 'otan', '3.5% of gdp', '3,5 % du pib', 'defence budget', 'budget de la défense', 'military base', 'bases militaires'])) {
    if (negScore > posScore && hasAny(['cancel', 'cut', 'freeze', 'annul', 'gel'])) {
      addAction('HAW', 'BEAR', 2, 15, 'Defence spending cut/delay slows Grayhawk backlog growth');
    } else {
      addAction('HAW', 'BULL', 3, 28, 'NATO/Ottawa defence spending hike expands Grayhawk $95B backlog');
      if (hasAny(['military base', 'bases militaires', 'ottawa'])) {
        addAction('NOR', 'BULL', 2, 18, 'Federal military base modernization adds Northline contracts');
      }
    }
  }

  // E. US Tariffs on Asian Imports / EU Supply-Chain Directive
  if (hasAny(['tariff', 'tarif', 'douane', 'asian import', 'importations asiatiques', 'european directive', 'directive européenne', 'bangladesh', 'vietnam'])) {
    if (hasAny(['exempt', 'drop', 'cancel', 'abandon', 'repousse', 'annul'])) {
      addAction('HOL', 'BULL', 2, 20, 'Tariff/regulatory relief lifts Hollis & Rowe Asian supply chain');
    } else {
      addAction('HOL', 'BEAR', 3, 22, '70% Asian production hit by import tariffs / EU supply-chain rules');
    }
  }

  // F. Ottawa-Brussels / EU Critical Minerals & Clean Energy Partnership
  if (hasAny(['european union', 'union européenne', 'brussels', 'bruxelles', 'european buyer', 'acheteurs européens']) &&
      hasAny(['critical metal', 'critical mineral', 'métaux critiques', 'minéraux critiques', 'lithium', 'nickel', 'cobalt', 'taïga', 'taiga'])) {
    if (negScore > posScore) {
      addAction('TAG', 'BEAR', 2, 15, 'Setback in European critical metals talks hurts Taïga');
    } else {
      addAction('TAG', 'BULL', 3, 28, 'EU critical-metals deal unlocks major offtake for Ressources Taïga');
    }
  }

  // =========================================================================
  // 2. COMPANY-SPECIFIC TRIGGERS (Direct & Anonymous Clues)
  // =========================================================================

  // 1. RAI — Rubicon AI
  if (hasAny(['rubicon', 'julian vance', 'alea-3', 'alea 3', 'legio', 'ravenne', 'artificial intelligence sector', 'secteur de l\'intelligence artificielle'])) {
    if (hasAny(['short position', 'positions à découvert', 'bubble', 'bulle', 'lock-up', 'blocage', 'former employee', 'anciens employés', 'doubt', 'doute', 'delay', 'retard', 'overvalued'])) {
      addAction('RAI', 'BEAR', 3, 20, 'Institutional shorting / lock-up / Legio doubts hit Rubicon AI (37x sales)');
    } else if (posScore >= negScore) {
      addAction('RAI', 'BULL', 3, 25, 'Rubicon AI / Project Legio / Alea-3 momentum catalyst');
    } else {
      addAction('RAI', 'BEAR', 2, 15, 'Negative catalyst on unprofitable Rubicon AI');
    }
  }

  // 2. PAL — Palissade Capital
  if (hasAny(['palissade', 'miles stern', 'office real estate', 'immobilier de bureau', 'commercial real estate', 'loan default', 'défaut de prêt'])) {
    // Check if Palissade Research is attacking ANOTHER stock (e.g. RAI)
    if (hasAny(['palissade research']) && hasAny(['rubicon', 'alea', 'legio', 'ai', 'intelligence artificielle'])) {
      addAction('RAI', 'BEAR', 3, 22, 'Bearish Palissade Research report targets Rubicon AI valuation');
    } else if (negScore > posScore) {
      addAction('PAL', 'BEAR', 3, 20, 'Credit/real-estate defaults or margin pressure hit Palissade Capital');
    } else if (posScore > 0) {
      addAction('PAL', 'BULL', 2, 18, 'Strong banking spread / asset management inflow for Palissade');
    }
  }

  // 3. ALE — Aldren Pharmaceuticals
  if (hasAny(['aldren', 'helen marsh', 'cardiva', 'ht-114', 'ht 114', 'obesity pill', 'pilule contre l\'obésité', 'heart failure', 'insuffisance cardiaque', 'patent cliff'])) {
    if (hasAny(['ht-114', 'ht 114', 'obesity', 'obésité', 'phase 3'])) {
      if (negScore > posScore) {
        addAction('ALE', 'BEAR', 3, 25, 'HT-114 Phase 3 setback leaves Aldren with no fallback after Cardiva');
      } else {
        addAction('ALE', 'BULL', 3, 32, 'HT-114 oral obesity pill Phase 3 success replaces Cardiva revenue');
      }
    } else if (hasAny(['cardiva', 'patent', 'brevet', 'generic', 'générique']) && negScore >= posScore) {
      addAction('ALE', 'BEAR', 3, 20, 'Cardiva (38% of sales) April 2030 patent cliff & generic erosion');
    } else if (negScore > posScore) {
      addAction('ALE', 'BEAR', 2, 15, 'Negative pharma/clinical headline for Aldren');
    } else if (posScore > 0) {
      addAction('ALE', 'BULL', 2, 20, 'Positive R&D / defensive healthcare catalyst for Aldren');
    }
  }

  // 4. TAG — Ressources Taïga
  if (hasAny(['taïga', 'taiga', 'luc bergeron', 'aurore', 'abitibi', 'val-d\'or', '55th parallel', '55e parallèle'])) {
    if (negScore > posScore) {
      addAction('TAG', 'BEAR', 3, 20, 'Subsidy, royalty, or Indigenous consultation setback on Aurore project');
    } else if (posScore > 0) {
      addAction('TAG', 'BULL', 3, 25, 'Aurore project / critical metals demand catalyst for cheap P/E 9 Taïga');
    }
  }

  // 5. HAW — Grayhawk Systems
  if (hasAny(['grayhawk', 'diane kessler', 'bastion'])) {
    if (hasAny(['human rights', 'droits de la personne', 'ethical', 'éthique', 'protest', 'scandal', 'cancel', 'defect', 'bug', 'panne'])) {
      addAction('HAW', 'BEAR', 2, 16, 'Military AI ethics backlash or Bastion OS issue hits Grayhawk');
    } else if (posScore >= negScore) {
      addAction('HAW', 'BULL', 3, 25, 'Defense contract / Bastion OS demand expands Grayhawk backlog');
    }
  }

  // 6. LIA — Hydrélia
  if (hasAny(['hydrélia', 'hydrelia', 'sophie lachance', 'bécancour', 'becancour', 'green hydrogen', 'hydrogène vert', 'electrolyzer', 'électrolyseur'])) {
    if (negScore > posScore || hasAny(['dilution', 'new shares', 'émission d\'actions', 'cost overrun', 'dépassement de coûts', 'delay', 'retard'])) {
      addAction('LIA', 'BEAR', 3, 20, 'Bécancour $1.2B plant financing/delay pressures unprofitable Hydrélia');
    } else if (posScore > 0) {
      addAction('LIA', 'BULL', 3, 25, 'Green hydrogen / grid storage contract boosts high-beta (1.9) Hydrélia');
    }
  }

  // 7. NOR — Northline Infrastructure
  if (hasAny(['northline', 'catherine doyle', 'far north highway', 'route du grand nord'])) {
    if (negScore > posScore) {
      addAction('NOR', 'BEAR', 3, 22, 'Delayed payments / fixed-price cost overrun hits thin 3.7% margin');
    } else if (posScore > 0) {
      addAction('NOR', 'BULL', 2, 20, 'Major infrastructure / Far North / housing contract for Northline');
    }
  }

  // 8. CHA — Épiceries Champlain
  if (hasAny(['champlain', 'isabelle gagnon', 'marché fleuve', 'marche fleuve', 'comptoir champlain', 'limoilou', 'grocers\' margins', 'marges des épiciers'])) {
    if (hasAny(['acquire', 'acquisition', 'papineau', 'restaurant']) && posScore >= negScore) {
      addAction('CHA', 'BULL', 2, 18, 'Comptoir Champlain / restaurant food-service expansion');
      if (hasAny(['papineau'])) {
        addAction('PIN', 'BULL', 3, 25, 'M&A buyout / partnership interest from Épiceries Champlain');
      }
    } else if (negScore > posScore || hasAny(['inquiry', 'enquête', 'price regulation', 'contrôle des prix', 'boycott'])) {
      addAction('CHA', 'BEAR', 2, 16, 'Political inquiry into grocery margins / price regulation risk');
    } else if (posScore > 0) {
      addAction('CHA', 'BULL', 2, 18, 'Defensive grocery & Marché Fleuve discount strength');
    }
  }

  // 9. PIN — Les Restaurants Papineau
  if (hasAny(['papineau', 'olivier desrosiers', 'poutine', 'minimum wage', 'salaire minimum', 'frozen meal', 'plats surgelés'])) {
    if (hasAny(['minimum wage', 'salaire minimum', 'covenant', '4 times', '3.6 times', 'debt', 'dette']) && negScore >= posScore) {
      addAction('PIN', 'BEAR', 3, 22, 'Minimum wage hike (34% labour) or 4.0x debt covenant crunch hurts PIN');
    } else if (negScore > posScore) {
      addAction('PIN', 'BEAR', 2, 16, 'Consumer slowdown hurts thin 2.8% margin & high P/E 30 Papineau');
    } else if (posScore > 0) {
      addAction('PIN', 'BULL', 2, 18, 'Frozen grocery meal rollout / Ontario expansion win for Papineau');
    }
  }

  // 10. HOL — Hollis & Rowe
  if (hasAny(['hollis', 'grant hollis', 'made to last', 'unsold stock', 'stocks invendus'])) {
    if (negScore > posScore) {
      addAction('HOL', 'BEAR', 3, 20, 'Asian supply-chain, NGO labour scandal, or tariff hit on Hollis & Rowe');
    } else if (posScore > 0) {
      addAction('HOL', 'BULL', 2, 20, 'Mexico reshoring / AI inventory (-30% unsold stock) boosts Hollis & Rowe');
    }
  }

  // Broad recession shock if no specific company was matched above
  if (!actions.length && hasAny(['recession', 'récession', 'economic downturn', 'ralentissement économique', 'unemployment', 'chômage'])) {
    addAction('PIN', 'BEAR', 3, 20, 'Recession hits dining out & pressures Papineau 3.6x debt covenant');
    addAction('PAL', 'BEAR', 2, 15, 'Recession increases commercial real estate loan defaults at Palissade');
    addAction('CHA', 'BULL', 2, 18, 'Defensive low-beta (0.5) grocery outperforms in recession');
  }

  const summary = actions.length
    ? actions.map((a) => `${a.action} ${a.ticker}`).join(', ')
    : 'No direct SBG 2026 playbook trigger matched';

  return { summary, actions: actions.slice(0, 3), model: 'curated-sbg-2026' };
};
