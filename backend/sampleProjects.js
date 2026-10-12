// Pre-configured industrial electrical projects for Dragno Electric CAD

export const SAMPLE_PROJECTS = [
  {
    id: 'proj_motor_starter',
    name: 'Sistema Arranque Motor Trifásico con Enclavamiento',
    company: 'INGENIERÍA DRAGNO ELECTRIC',
    designer: 'Ing. Proyectista',
    sheets: [
      {
        id: 'sheet_mando',
        title: 'Circuito de Mando 230VAC',
        sizeKey: 'A4_HORIZONTAL',
        width: 1100,
        height: 750,
        components: [
          {
            id: 'cmp_sb_stop',
            type: 'BUTTON_NC',
            tag: 'SB1',
            x: 200,
            y: 350,
            state: { closed: true, pressed: false }
          },
          {
            id: 'cmp_sb_start',
            type: 'BUTTON_NO',
            tag: 'SB2',
            x: 200,
            y: 440,
            state: { closed: false, pressed: false }
          }
        ],
        wires: [
          {
            id: 'w4',
            from: { compId: 'cmp_sb_stop', pinId: '12' },
            to: { compId: 'cmp_sb_start', pinId: '13' },
            waypoints: [{ x: 200, y: 375 }, { x: 200, y: 415 }]
          }
        ]
      },
      {
        id: 'sheet_fuerza',
        title: 'Circuito de Fuerza 400VAC',
        sizeKey: 'A4_HORIZONTAL',
        width: 1100,
        height: 750,
        components: [],
        wires: []
      }
    ]
  }
];
