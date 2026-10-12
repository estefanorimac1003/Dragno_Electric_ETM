# ⚡ DRAGNO ELECTRIC CAD & SIMULATOR
> **Sistema CAD profesional para diseño, gestión y simulación interactiva de planos eléctricos con exportación en formato AutoCAD DXF.**

Diseñado bajo la experiencia visual y flujo de trabajo de **ControlMAX 360** combinada estrictamente con la **estética industrial clásica de AutoCAD** (lienzo oscuro/charcoal, líneas vectoriales de alta precisión en cian, amarillo, verde, rojo y blanco, grilla de coordenadas y cursor en cruz tipo *crosshairs*).

---

## 🚀 Características Principales

### 1. Interfaz de Usuario y Experiencia CAD (ControlMAX 360 + AutoCAD)
- **Lienzo Gráfico de Alta Precisión (2D Vector Canvas):**
  - Fondo industrial oscuro (`#0c0e12` / `#101318`).
  - Marco y cajetín técnico normalizado (**IEC 60617 / DIN A4 y A3**) con cuadrícula de coordenadas perimetrales (columnas A-H, filas 1-6) y datos de proyecto, diseñador, empresa, fecha y número de hoja.
  - Cursor en cruz (*AutoCAD Crosshairs*) dinámico a pantalla completa con cuadro de selección (*pickbox*) y lectura de coordenadas $(X, Y, Z)$ en tiempo real en la barra de estado.
  - Zoom interactivo centrado en cursor y paneo suave con botón central del ratón, tecla Espacio o herramienta *Pan*.
  - Modos auxiliares: **GRID (Rejilla de puntos)**, **SNAP (Ajuste magnético a 10px/20px)** y **ORTHO (Trazado de cables ortogonal)**.

- **Panel Superior (Gestor de Pestañas y Herramientas Rápidas):**
  - Pestañas dinámicas para navegar entre diferentes planos/hojas de circuitos del proyecto (ej: *Circuito de Mando 230VAC*, *Circuito de Fuerza 400VAC*).
  - Creación de nuevas hojas (`+`) y cierre de hojas (`x`).
  - Herramientas CAD rápidas: Selección/Mover (`V`), Conectar Cableado (`W`), Paneo (`H`), Borrar (`Supr`), Selector de Presets de esquemas industriales.
  - Botón **"DISEÑADOR DE PIEZAS"**: Acceso directo al estudio de diseño y edición de símbolos.
  - Botón de exportación directa a **AutoCAD DXF**.
  - Botón maestro de **"INICIAR SIMULACIÓN"** / **"DETENER SIMULACIÓN"** con efecto neón pulsante.

- **Diseñador y Editor de Piezas Eléctricas (CAD Symbol Studio):**
  - Permite alterar completamente la geometría vectorial y bornes de conexión de cualquier componente o crear nuevas piezas desde cero.
  - **Lienzo Micro-CAD con cuadrícula y coordenadas $(0,0)$:** Añade, mueve y redimensiona trazos vectoriales (Líneas, Rectángulos, Círculos, Textos de Tag) con colores de trazo AutoCAD y rellenos.
  - **Gestor Visual de Terminales / Conexiones (Pins):** Permite añadir nuevos bornes, renombrar identificadores (ej. `A1`, `A2`, `13`, `14`, `1`, `2`), y arrastrar sus coordenadas con ajuste magnético.
  - **Configuración de Rol Eléctrico:** Define si la pieza actúa como bobina, interruptor, contacto NA/NC, carga luminosa, motor o fuente de alimentación.
  - **Previsualización de Simulación:** Permite alternar la vista entre estado de reposo y estado energizado/activo antes de guardar.
  - Persistencia automática en el navegador (`localStorage`) y exportación 1:1 a formato DXF.

- **Panel Izquierdo (Navegador de Proyecto, Símbolos y Tags):**
  - **Biblioteca de Símbolos Eléctricos:** Buscador integrado y categorías organizadas (*Lo más usado*, *Potenciales y Señales*, *Protección Eléctrica*, *Mandos y Actuadores*, *Cargas y Motores*). Arrastre y colocación con un solo clic.
  - **Árbol de Proyecto:** Estructura jerárquica de carpetas, planos y dispositivos por hoja.
  - **Gestor de Sincronización de Tags:** Listado de todos los identificadores únicos (`KM1`, `SB1`, `QM1`, `FR1`) mostrando cuántos componentes comparten dicho tag y su estado en tiempo real.

- **Panel Derecho (Inspector de Atributos):**
  - **Propiedades del Elemento:** Edición del tag/nombre, tipo, coordenadas y estado de contactos.
  - **Atributos de Lienzo:** Modificación de título de plano, tamaño de hoja (A4 Horizontal, A3, etc.) y conmutadores de cuadrícula y snap.

- **Barra Inferior (Línea de Comandos & BOM):**
  - Consola desplegable de logs con el historial de eventos eléctricos generados por el motor de simulación.
  - Botón de **Listado de Materiales (BOM)** con resumen tabulado de dispositivos por hoja y cantidad.

---

### 2. Sincronización Lógica por Nombre / Identificador
- **Regla de Vinculación Automática:** Todo componente que comparta el **mismo tag** (por ejemplo, Bobina `KM1`, Contacto Auxiliar NA `KM1` 13-14, y Contactos Principales de Fuerza `KM1` 1-2, 3-4, 5-6) se enlaza lógicamente a nivel de proyecto.
- **Acción en Tiempo Real:** Al energizarse la bobina `KM1`, todos sus contactos asociados reaccionan inmediatamente:
  - Los contactos Normalmente Abiertos (**NA**) se cierran y conducen corriente.
  - Los contactos Normalmente Cerrados (**NC**) se abren.
  - Permite esquemas de **auto-enclavamiento / retención** (Marcha-Paro) e inversión de giro automáticos.

---

### 3. Motor de Simulación Dinámica de Circuitos
- Análisis topológico mediante grafo de conectividad y unión de potenciales (Fases $L, L1, L2, L3$, Neutro $N$, Tierra $PE$, $+24V$ DC, $0V$ DC).
- Detección de bucles cerrados de alimentación sobre cargas (bobinas, pilotos, motores trifásicos).
- **Animaciones en vivo:**
  - Los cables energizados se iluminan en amarillo neón con efecto de pulso y flujo de corriente interactivo.
  - Las bobinas emiten un halo magnético verde.
  - Los pilotos de señalización brillan con degradado radial de alta visibilidad.
  - Los motores trifásicos muestran indicador de rotación dinámico.
- **Interacción en Vivo:** Mientras la simulación está activa, el usuario puede hacer clic en pulsadores (Start `SB2`, Stop `SB1`), disyuntores (`QM1`) o relés térmicos (`FR1`) para conmutar su estado y observar la respuesta inmediata del circuito.

---

### 4. Generación y Exportación a Formato AutoCAD DXF
- Genera archivos `.dxf` normalizados compatibles con **AutoCAD (Release 12 / R2000 ASCII)**, **LibreCAD**, **nanoCAD** y **Autodesk Viewer**.
- Distribución estricta por capas de ingeniería estándar:
  - `ESQ_MARCO`: Marco perimetral y cajetín técnico normalizado (Color ACI 3 - Verde).
  - `ESQ_CABLES_CONTROL`: Líneas de interconexión de mando (Color ACI 4 - Cian).
  - `ESQ_CABLES_POTENCIA`: Líneas de potencia trifásica (Color ACI 1 - Rojo).
  - `ESQ_SIMBOLOS`: Geometría vectorial de los componentes eléctricos (Color ACI 7 - Blanco).
  - `ESQ_TERMINALES`: Identificación de bornes y pines de conexión (Color ACI 5 - Azul).
  - `ESQ_TEXTOS`: Identificadores de tags, tensiones y rotulación técnica (Color ACI 2 - Amarillo).

---

## 📁 Estructura del Proyecto

```
Dragno Electric/
├── pnpm-workspace.yaml          # Configuración del monorepo pnpm (frontend y backend)
├── package.json                 # Scripts raíz (pnpm dev, pnpm build, pnpm start)
├── frontend/                    # FRONTEND (React 18 + Vite + Tailwind CSS)
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx
│       ├── App.jsx              # Coordinador de estado global y vistas
│       ├── index.css            # Estilos CAD y animaciones eléctricas
│       ├── cad/
│       │   ├── symbolCatalog.js # Definición gráfica y pines de símbolos IEC/DIN
│       │   ├── titleBlock.js    # Trazado de marco y cajetín A4/A3 normalizado
│       │   └── dxfGenerator.js  # Motor de generación vectorial DXF
│       ├── simulation/
│       │   └── circuitSolver.js # Motor solver de potenciales y sincronización
│       ├── services/
│       │   └── dxfExporter.js   # Servicio de descarga y llamada API
│       └── components/
│           ├── TopBar.jsx               # Pestañas de planos y barra de herramientas
│           ├── LeftSidebar.jsx          # Biblioteca de símbolos y árbol de proyecto
│           ├── RightSidebar.jsx         # Inspector de propiedades y lienzo
│           ├── CadCanvas.jsx            # Lienzo interactivo con crosshairs y zoom
│           ├── BottomStatusBar.jsx      # Barra de estado y consola de simulación
│           └── DeviceListModal.jsx      # Listado de materiales (BOM)
└── backend/                     # BACKEND (Node.js + Express)
    ├── package.json
    ├── index.js                 # Servidor API Express y distribución de estáticos
    ├── sampleProjects.js        # Esquemas preconfigurados (Arranque Marcha-Paro)
    └── services/
        └── dxfGenerator.js      # Generador DXF del lado del servidor
```

---

## 🛠️ Instalación y Ejecución

### Requisitos Previos
- **Node.js**: v18 o superior (v20+ recomendado).
- **pnpm**: v9 o superior (`pnpm -v`).

---

### Paso 1: Instalación de Dependencias
Ejecuta en la raíz del proyecto:
```bash
pnpm install
```

---

### Paso 2: Modo Desarrollo (Frontend + Backend concurrentes)
Ejecuta:
```bash
pnpm dev
```
Este comando lanzará simultáneamente:
- **Backend API:** `http://localhost:3001`
- **Frontend CAD (Vite Dev Server):** `http://localhost:5173`

Abre en tu navegador:
👉 **`http://localhost:5173/`**

---

### Paso 3: Compilación y Modo Producción
Para compilar la aplicación y ejecutar el servidor unificado:
```bash
# Compilar bundle optimizado del frontend
pnpm build

# Iniciar servidor de producción
pnpm start
```
El servidor servirá la aplicación completa en:
👉 **`http://localhost:3001/`**
