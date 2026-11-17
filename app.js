"use strict";

const $ = selector => document.querySelector(selector);
const svgNS = "http://www.w3.org/2000/svg";
const DESIGN_KEY = "mon-atelier-design-v2";
const TASK_KEY = "mon-atelier-tasks-v2";

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

function demoDesign() {
  return {
    background: "#f4f0e9",
    layers: [
      {
        id: uid(), type: "rect", name: "Bandeau décoratif", x: 0, y: 0,
        width: 800, height: 18, rotation: 0, opacity: 1,
        color: "#d76b4b", stroke: "#d76b4b", strokeWidth: 0,
        visible: true, locked: false
      },
      {
        id: uid(), type: "circle", name: "Forme décorative", x: 583, y: 85,
        width: 145, height: 145, rotation: 0, opacity: 0.95,
        color: "#e9b87e", stroke: "#e9b87e", strokeWidth: 0,
        visible: true, locked: false
      },
      {
        id: uid(), type: "text", name: "Petit titre", x: 72, y: 78,
        width: 500, height: 40, rotation: 0, opacity: 1,
        color: "#c05e43", stroke: "#c05e43", strokeWidth: 0,
        text: "RENDEZ-VOUS CRÉATIF", font: "Arial",
        fontSize: 17, bold: true, italic: false, visible: true, locked: false
      },
      {
        id: uid(), type: "text", name: "Titre principal", x: 67, y: 142,
        width: 620, height: 120, rotation: 0, opacity: 1,
        color: "#19263b", stroke: "#19263b", strokeWidth: 0,
        text: "SOIRÉE\nCRÉATIVE", font: "Georgia",
        fontSize: 74, bold: true, italic: false, visible: true, locked: false
      },
      {
        id: uid(), type: "rect", name: "Bannière", x: 72, y: 385,
        width: 278, height: 54, rotation: 0, opacity: 1,
        color: "#d76b4b", stroke: "#d76b4b", strokeWidth: 0,
        visible: true, locked: false
      },
      {
        id: uid(), type: "text", name: "Texte de la bannière", x: 91, y: 395,
        width: 250, height: 35, rotation: 0, opacity: 1,
        color: "#ffffff", stroke: "#ffffff", strokeWidth: 0,
        text: "SAMEDI · 20 H", font: "Arial",
        fontSize: 22, bold: true, italic: false, visible: true, locked: false
      },
      {
        id: uid(), type: "text", name: "Lieu", x: 75, y: 480,
        width: 400, height: 30, rotation: 0, opacity: 1,
        color: "#4d596b", stroke: "#4d596b", strokeWidth: 0,
        text: "ATELIER • MUSIQUE • RENCONTRES", font: "Arial",
        fontSize: 15, bold: false, italic: false, visible: true, locked: false
      },
      {
        id: uid(), type: "text", name: "Entrée", x: 75, y: 520,
        width: 300, height: 25, rotation: 0, opacity: 1,
        color: "#4d596b", stroke: "#4d596b", strokeWidth: 0,
        text: "ENTRÉE LIBRE", font: "Arial",
        fontSize: 13, bold: true, italic: false, visible: true, locked: false
      }
    ]
  };
}

let design;
try {
  design = JSON.parse(localStorage.getItem(DESIGN_KEY)) || demoDesign();
} catch {
  design = demoDesign();
}

let tasks;
try {
  tasks = JSON.parse(localStorage.getItem(TASK_KEY)) || [];
} catch {
  tasks = [];
}

let selectedId = null;
let filter = "all";
let dragState = null;
let undoStack = [];
let redoStack = [];

function download(filename, content, type) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(new Blob([content], { type }));
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function saveDesign() {
  localStorage.setItem(DESIGN_KEY, JSON.stringify(design));
  const status = $(".save-status");
  if (status) status.innerHTML = "<i></i> Enregistré sur cet appareil";
}

function saveTasks() {
  localStorage.setItem(TASK_KEY, JSON.stringify(tasks));
}

function snapshot() {
  undoStack.push(JSON.stringify(design));
  if (undoStack.length > 30) undoStack.shift();
  redoStack = [];
}

function newLayer(type, extra = {}) {
  snapshot();
  const layer = {
    id: uid(), type, name: type === "text" ? "Nouveau texte" : "Nouvelle forme",
    x: 100, y: 100, width: 240, height: 100, rotation: 0, opacity: 1,
    color: "#d76b4b", stroke: "#172033", strokeWidth: 0,
    visible: true, locked: false, text: "Votre texte",
    font: "Georgia", fontSize: 38, bold: true, italic: false,
    shadow: false, blur: 0, ...extra
  };
  design.layers.push(layer);
  selectedId = layer.id;
  renderEditor();
}

function createSvgLayer(layer) {
  let el;

  if (layer.type === "text") {
    el = document.createElementNS(svgNS, "text");
    el.setAttribute("x", layer.x);
    el.setAttribute("y", Number(layer.y) + Number(layer.fontSize || 32));
    el.setAttribute("font-family", layer.font || "Arial");
    el.setAttribute("font-size", layer.fontSize || 32);
    el.setAttribute("font-weight", layer.bold ? "bold" : "normal");
    el.setAttribute("font-style", layer.italic ? "italic" : "normal");
    el.setAttribute("fill", layer.color || "#172033");
    String(layer.text || "").split("\n").forEach((line, index) => {
      const span = document.createElementNS(svgNS, "tspan");
      span.setAttribute("x", layer.x);
      if (index) span.setAttribute("dy", "1.05em");
      span.textContent = line;
      el.append(span);
    });
  } else if (layer.type === "image") {
    el = document.createElementNS(svgNS, "image");
    el.setAttribute("href", layer.src || "");
    el.setAttribute("x", layer.x);
    el.setAttribute("y", layer.y);
    el.setAttribute("width", layer.width);
    el.setAttribute("height", layer.height);
    el.setAttribute("preserveAspectRatio", "xMidYMid meet");
  } else if (layer.type === "circle") {
    el = document.createElementNS(svgNS, "ellipse");
    el.setAttribute("cx", Number(layer.x) + Number(layer.width) / 2);
    el.setAttribute("cy", Number(layer.y) + Number(layer.height) / 2);
    el.setAttribute("rx", Number(layer.width) / 2);
    el.setAttribute("ry", Number(layer.height) / 2);
    el.setAttribute("fill", layer.color);
  } else {
    el = document.createElementNS(svgNS, "rect");
    el.setAttribute("x", layer.x);
    el.setAttribute("y", layer.y);
    el.setAttribute("width", layer.width);
    el.setAttribute("height", layer.height);
    el.setAttribute("fill", layer.color);
  }

  el.dataset.id = layer.id;
  el.setAttribute("opacity", layer.opacity ?? 1);

  if (Number(layer.strokeWidth) > 0) {
    el.setAttribute("stroke", layer.stroke || "#172033");
    el.setAttribute("stroke-width", layer.strokeWidth);
  }

  const filters = [];
  if (layer.shadow) filters.push("drop-shadow(3px 4px 4px #0005)");
  if (Number(layer.blur) > 0) filters.push(`blur(${layer.blur}px)`);
  if (filters.length) el.style.filter = filters.join(" ");

  if (Number(layer.rotation)) {
    const cx = Number(layer.x) + Number(layer.width) / 2;
    const cy = Number(layer.y) + Number(layer.height) / 2;
    el.setAttribute("transform", `rotate(${layer.rotation} ${cx} ${cy})`);
  }

  el.style.cursor = layer.locked ? "default" : "move";
  el.addEventListener("pointerdown", beginDrag);
  return el;
}

function renderEditor() {
  const canvas = $("#canvas");
  canvas.replaceChildren();
  canvas.style.backgroundColor = design.background || "#ffffff";

  design.layers.forEach(layer => {
    if (layer.visible) canvas.append(createSvgLayer(layer));
  });

  $("#background-color").value = design.background || "#ffffff";
  $("#layer-count").textContent = design.layers.length;
  renderLayerList();
  renderProperties();
  saveDesign();
}

function beginDrag(event) {
  const layer = design.layers.find(item => item.id === event.currentTarget.dataset.id);
  if (!layer || layer.locked) return;

  selectedId = layer.id;
  snapshot();
  dragState = {
    layer, pointerX: event.clientX, pointerY: event.clientY,
    x: Number(layer.x), y: Number(layer.y)
  };
  renderLayerList();
  renderProperties();
}

$("#canvas").addEventListener("pointermove", event => {
  if (!dragState) return;
  const box = $("#canvas").getBoundingClientRect();
  dragState.layer.x = Math.round(dragState.x + (event.clientX - dragState.pointerX) * 800 / box.width);
  dragState.layer.y = Math.round(dragState.y + (event.clientY - dragState.pointerY) * 600 / box.height);

  // Met à jour l’aperçu sans recréer les éléments pendant le glissement.
  const el = $("#canvas").querySelector(`[data-id="${dragState.layer.id}"]`);
  if (el) {
    if (dragState.layer.type === "text") {
      el.setAttribute("x", dragState.layer.x);
      el.querySelectorAll("tspan").forEach(span => span.setAttribute("x", dragState.layer.x));
    } else if (dragState.layer.type === "circle") {
      el.setAttribute("cx", Number(dragState.layer.x) + Number(dragState.layer.width) / 2);
    } else {
      el.setAttribute("x", dragState.layer.x);
    }
    if (dragState.layer.type === "circle") {
      el.setAttribute("cy", Number(dragState.layer.y) + Number(dragState.layer.height) / 2);
    } else if (dragState.layer.type === "text") {
      el.setAttribute("y", Number(dragState.layer.y) + Number(dragState.layer.fontSize || 32));
    } else {
      el.setAttribute("y", dragState.layer.y);
    }
  }
  renderProperties();
});

function finishDrag() {
  if (!dragState) return;
  dragState = null;
  renderEditor();
}
$("#canvas").addEventListener("pointerup", finishDrag);
$("#canvas").addEventListener("pointercancel", finishDrag);

function renderLayerList() {
  const list = $("#layer-list");
  list.replaceChildren();

  [...design.layers].reverse().forEach(layer => {
    const actualIndex = design.layers.findIndex(item => item.id === layer.id);
    const row = document.createElement("li");
    row.className = "layer-row" + (layer.id === selectedId ? " selected" : "");

    const icon = document.createElement("span");
    icon.className = "layer-icon";
    icon.textContent = layer.type === "text" ? "T" :
      layer.type === "image" ? "▧" : layer.type === "circle" ? "◯" : "▰";

    const name = document.createElement("button");
    name.className = "layer-name";
    name.textContent = layer.name || layer.type;
    name.onclick = () => { selectedId = layer.id; renderEditor(); };

    const actions = document.createElement("span");
    actions.className = "layer-actions";

    const visibility = document.createElement("button");
    visibility.textContent = layer.visible ? "◉" : "○";
    visibility.title = "Afficher/masquer";
    visibility.onclick = () => { layer.visible = !layer.visible; renderEditor(); };

    const lock = document.createElement("button");
    lock.textContent = layer.locked ? "▣" : "◇";
    lock.title = "Verrouiller/déverrouiller";
    lock.onclick = () => { layer.locked = !layer.locked; renderEditor(); };

    const up = document.createElement("button");
    up.textContent = "↑";
    up.title = "Monter dans la pile";
    up.onclick = () => {
      if (actualIndex < design.layers.length - 1) {
        [design.layers[actualIndex], design.layers[actualIndex + 1]] =
          [design.layers[actualIndex + 1], design.layers[actualIndex]];
        renderEditor();
      }
    };

    const down = document.createElement("button");
    down.textContent = "↓";
    down.title = "Descendre dans la pile";
    down.onclick = () => {
      if (actualIndex > 0) {
        [design.layers[actualIndex], design.layers[actualIndex - 1]] =
          [design.layers[actualIndex - 1], design.layers[actualIndex]];
        renderEditor();
      }
    };

    actions.append(visibility, lock, up, down);
    row.append(icon, name, actions);
    list.append(row);
  });
}

function renderProperties() {
  const box = $("#properties");
  box.replaceChildren();

  const layer = design.layers.find(item => item.id === selectedId);
  if (!layer) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Sélectionnez un calque pour modifier ses propriétés.";
    box.append(empty);
    return;
  }

  const fields = [
    ["Nom", "name", "text"], ["Position X", "x", "number"],
    ["Position Y", "y", "number"], ["Largeur", "width", "number"],
    ["Hauteur", "height", "number"], ["Rotation", "rotation", "number"],
    ["Opacité", "opacity", "number"], ["Couleur", "color", "color"],
    ["Contour", "stroke", "color"], ["Épaisseur", "strokeWidth", "number"],
    ["Flou", "blur", "number"]
  ];
  if (layer.type === "text") {
    fields.push(
      ["Texte", "text", "text"], ["Police", "font", "text"],
      ["Taille", "fontSize", "number"]
    );
  }

  fields.forEach(([label, key, type]) => {
    const row = document.createElement("label");
    row.append(document.createTextNode(label));
    const input = document.createElement("input");
    input.type = type;
    input.value = layer[key] ?? "";
    if (key === "opacity") {
      input.min = 0; input.max = 1; input.step = 0.05;
    }
    input.onchange = () => {
      snapshot();
      layer[key] = type === "number" ? Number(input.value) : input.value;
      renderEditor();
    };
    row.append(input);
    box.append(row);
  });

  [["Gras", "bold"], ["Italique", "italic"], ["Ombre", "shadow"]].forEach(([title, key]) => {
    const row = document.createElement("label");
    row.className = "check-row";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(layer[key]);
    input.onchange = () => { snapshot(); layer[key] = input.checked; renderEditor(); };
    row.append(input, document.createTextNode(title));
    box.append(row);
  });

  const remove = document.createElement("button");
  remove.className = "button button-quiet";
  remove.textContent = "Supprimer ce calque";
  remove.style.marginTop = "8px";
  remove.onclick = () => {
    snapshot();
    design.layers = design.layers.filter(item => item.id !== selectedId);
    selectedId = null;
    renderEditor();
  };
  box.append(remove);
}

// Tâches
function renderTasks() {
  const list = $("#task-list");
  list.replaceChildren();

  const shown = tasks.filter(task =>
    filter === "all" || (filter === "todo" && !task.done) ||
    (filter === "done" && task.done)
  );

  if (!shown.length) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "Aucune tâche dans cette vue. Ajoutez-en une ci-dessus.";
    list.append(empty);
    return;
  }

  shown.forEach(task => {
    const row = document.createElement("li");
    row.className = "task-item" + (task.done ? " completed" : "");

    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = task.done;
    check.onchange = () => {
      task.done = check.checked;
      saveTasks();
      renderTasks();
    };

    const title = document.createElement("span");
    title.className = "task-text";
    title.textContent = task.title;

    const meta = document.createElement("span");
    meta.className = "task-meta";
    meta.textContent = task.date ? task.date : "";

    const priority = document.createElement("span");
    priority.className = "priority" + (task.priority === "Haute" ? " haute" : "");
    priority.textContent = task.priority || "Normale";

    const edit = document.createElement("button");
    edit.textContent = "Modifier";
    edit.onclick = () => {
      const value = prompt("Modifier la tâche :", task.title);
      if (value && value.trim()) {
        task.title = value.trim();
        saveTasks();
        renderTasks();
      }
    };

    const remove = document.createElement("button");
    remove.textContent = "Supprimer";
    remove.onclick = () => {
      tasks = tasks.filter(item => item.id !== task.id);
      saveTasks();
      renderTasks();
    };

    row.append(check, title, meta, priority, edit, remove);
    list.append(row);
  });
}

$("#task-form").onsubmit = event => {
  event.preventDefault();
  tasks.push({
    id: uid(),
    title: $("#task-title").value.trim(),
    date: $("#task-date").value,
    priority: $("#task-priority").value,
    done: false
  });
  $("#task-form").reset();
  saveTasks();
  renderTasks();
};

document.querySelectorAll("[data-filter]").forEach(button => {
  button.onclick = () => {
    filter = button.dataset.filter;
    document.querySelectorAll(".filter-button").forEach(item =>
      item.classList.toggle("active", item === button)
    );
    renderTasks();
  };
});

// Navigation
document.querySelectorAll("[data-page]").forEach(button => {
  button.onclick = () => {
    document.querySelectorAll(".nav-button").forEach(item =>
      item.classList.toggle("active", item === button)
    );
    document.querySelectorAll(".page").forEach(page => page.classList.add("hidden"));
    $("#" + button.dataset.page).classList.remove("hidden");
  };
});

// Boutons de l’éditeur
$("#add-text").onclick = () => newLayer("text");
$("#side-add-text").onclick = () => newLayer("text");
$("#add-rect").onclick = () => newLayer("rect");
$("#add-circle").onclick = () => newLayer("circle");

$("#background-color").oninput = event => {
  snapshot();
  design.background = event.target.value;
  renderEditor();
};

$("#image-file").onchange = event => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => newLayer("image", {
    name: file.name, src: reader.result, width: 320, height: 220
  });
  reader.readAsDataURL(file);
  event.target.value = "";
};

$("#reset-demo").onclick = () => {
  if (!confirm("Remplacer l’affiche actuelle par la démo ?")) return;
  snapshot();
  design = demoDesign();
  selectedId = null;
  renderEditor();
};

$("#undo").onclick = () => {
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify(design));
  design = JSON.parse(undoStack.pop());
  renderEditor();
};
$("#redo").onclick = () => {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(design));
  design = JSON.parse(redoStack.pop());
  renderEditor();
};

// Exports
function getSvg() {
  const clone = $("#canvas").cloneNode(true);
  clone.setAttribute("xmlns", svgNS);
  clone.setAttribute("width", "800");
  clone.setAttribute("height", "600");
  return new XMLSerializer().serializeToString(clone);
}

$("#export-svg").onclick = () =>
  download("mon-affiche.svg", getSvg(), "image/svg+xml");

$("#export-json").onclick = () =>
  download("mon-projet.json", JSON.stringify(design, null, 2), "application/json");

$("#export-png").onclick = () => {
  const url = URL.createObjectURL(new Blob([getSvg()], { type: "image/svg+xml" }));
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    const context = canvas.getContext("2d");
    context.fillStyle = design.background || "#ffffff";
    context.fillRect(0, 0, 800, 600);
    context.drawImage(image, 0, 0);
    canvas.toBlob(blob => {
      if (blob) download("mon-affiche.png", blob, "image/png");
      URL.revokeObjectURL(url);
    });
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    alert("L’export PNG a échoué. Réessayez ou exportez en SVG.");
  };
  image.src = url;
};

$("#top-export").onclick = () => $("#export-png").click();

$("#json-file").onchange = event => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported.layers)) throw new Error();
      design = imported;
      selectedId = null;
      renderEditor();
    } catch {
      alert("Ce fichier n’est pas un projet Mon Atelier valide.");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
};

$("#export-jsx").onclick = () => {
  const layers = JSON.stringify(design.layers).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const jsx = `#target photoshop
app.bringToFront();
var layers = eval('(' + '${layers}' + ')');
var doc = app.documents.add(800, 600, 72, "Mon Atelier");
function makeColor(hex) {
  var c = new SolidColor();
  c.rgb.hexValue = hex.replace("#", "");
  return c;
}
for (var i = 0; i < layers.length; i++) {
  var l = layers[i];
  if (!l.visible) continue;
  if (l.type === "text") {
    var t = doc.artLayers.add();
    t.kind = LayerKind.TEXT;
    t.name = l.name || "Texte";
    t.textItem.contents = l.text || "";
    t.textItem.position = [Number(l.x), Number(l.y) + Number(l.fontSize || 32)];
    t.textItem.size = Number(l.fontSize || 32);
    t.textItem.color = makeColor(l.color || "#172033");
  } else if (l.type === "rect" || l.type === "circle") {
    var s = doc.artLayers.add();
    s.name = l.name || "Forme";
    doc.selection.select([
      [Number(l.x), Number(l.y)],
      [Number(l.x) + Number(l.width), Number(l.y)],
      [Number(l.x) + Number(l.width), Number(l.y) + Number(l.height)],
      [Number(l.x), Number(l.y) + Number(l.height)]
    ]);
    doc.selection.fill(makeColor(l.color || "#d76b4b"));
    doc.selection.deselect();
  }
}
`;
  download("mon-atelier-photoshop.jsx", jsx, "text/plain");
};

// Démarrage
renderEditor();
renderTasks();
