"use strict";

const $ = selector => document.querySelector(selector);
const svgNS = "http://www.w3.org/2000/svg";

let tasks = JSON.parse(localStorage.getItem("atelier-tasks") || "[]");
let design = JSON.parse(localStorage.getItem("atelier-design") || "null") || {
  background: "#ffffff",
  layers: []
};
let selected = null;
let currentFilter = "all";
let dragging = null;

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

function download(filename, content, type) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// Navigation
document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(tab =>
      tab.classList.toggle("active", tab === button)
    );
    document.querySelectorAll(".page").forEach(page => page.classList.add("hidden"));
    $("#" + button.dataset.page).classList.remove("hidden");
  });
});

// Tâches
function renderTasks() {
  const list = $("#task-list");
  list.replaceChildren();

  tasks.forEach(task => {
    if (currentFilter === "todo" && task.done) return;
    if (currentFilter === "done" && !task.done) return;

    const item = document.createElement("li");
    item.className = task.done ? "completed" : "";

    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = task.done;
    check.setAttribute("aria-label", "Marquer comme terminée");
    check.onchange = () => {
      task.done = check.checked;
      saveTasks();
      renderTasks();
    };

    const title = document.createElement("span");
    title.className = "task-name";
    title.textContent = task.title;

    const detail = document.createElement("small");
    detail.textContent = [
      task.date ? `Échéance : ${task.date}` : "",
      `Priorité : ${task.priority}`
    ].filter(Boolean).join(" · ");

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

    item.append(check, title, detail, edit, remove);
    list.append(item);
  });
}

function saveTasks() {
  localStorage.setItem("atelier-tasks", JSON.stringify(tasks));
}

$("#task-form").addEventListener("submit", event => {
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
});

document.querySelectorAll("[data-filter]").forEach(button => {
  button.onclick = () => {
    currentFilter = button.dataset.filter;
    renderTasks();
  };
});

// Éditeur
function saveDesign() {
  localStorage.setItem("atelier-design", JSON.stringify(design));
}

function addLayer(type, extra = {}) {
  const layer = {
    id: uid(), type, name: type, x: 80, y: 70,
    width: 240, height: 110, rotation: 0, opacity: 1,
    color: "#2878d0", stroke: "#172033", strokeWidth: 0,
    visible: true, locked: false, text: "Votre texte",
    font: "Arial", fontSize: 42, bold: false, italic: false,
    shadow: false, blur: 0, ...extra
  };
  design.layers.push(layer);
  selected = layer.id;
  renderEditor();
}

function svgElement(layer) {
  let element;

  if (layer.type === "text") {
    element = document.createElementNS(svgNS, "text");
    element.setAttribute("x", layer.x);
    element.setAttribute("y", Number(layer.y) + Number(layer.fontSize));
    element.textContent = layer.text || "";
    element.setAttribute("font-family", layer.font || "Arial");
    element.setAttribute("font-size", layer.fontSize || 32);
    element.setAttribute("font-weight", layer.bold ? "bold" : "normal");
    element.setAttribute("font-style", layer.italic ? "italic" : "normal");
    element.setAttribute("fill", layer.color);
  } else if (layer.type === "image") {
    element = document.createElementNS(svgNS, "image");
    element.setAttribute("href", layer.src);
    element.setAttribute("x", layer.x);
    element.setAttribute("y", layer.y);
    element.setAttribute("width", layer.width);
    element.setAttribute("height", layer.height);
    element.setAttribute("preserveAspectRatio", "none");
  } else {
    element = document.createElementNS(
      svgNS, layer.type === "circle" ? "ellipse" : "rect"
    );

    if (layer.type === "circle") {
      element.setAttribute("cx", Number(layer.x) + Number(layer.width) / 2);
      element.setAttribute("cy", Number(layer.y) + Number(layer.height) / 2);
      element.setAttribute("rx", Number(layer.width) / 2);
      element.setAttribute("ry", Number(layer.height) / 2);
    } else {
      element.setAttribute("x", layer.x);
      element.setAttribute("y", layer.y);
      element.setAttribute("width", layer.width);
      element.setAttribute("height", layer.height);
    }
    element.setAttribute("fill", layer.color);
  }

  element.dataset.id = layer.id;
  element.setAttribute("opacity", layer.opacity);
  if (Number(layer.strokeWidth) > 0) {
    element.setAttribute("stroke", layer.stroke);
    element.setAttribute("stroke-width", layer.strokeWidth);
  }

  const filters = [];
  if (layer.shadow) filters.push("drop-shadow(4px 4px 4px #0008)");
  if (Number(layer.blur)) filters.push(`blur(${layer.blur}px)`);
  if (filters.length) element.style.filter = filters.join(" ");

  if (Number(layer.rotation)) {
    const cx = Number(layer.x) + Number(layer.width) / 2;
    const cy = Number(layer.y) + Number(layer.height) / 2;
    element.setAttribute("transform", `rotate(${layer.rotation} ${cx} ${cy})`);
  }

  element.style.cursor = layer.locked ? "default" : "move";
  element.addEventListener("pointerdown", startDrag);
  return element;
}

function renderEditor() {
  const canvas = $("#canvas");
  canvas.replaceChildren();
  canvas.style.background = design.background;

  design.layers.forEach(layer => {
    if (layer.visible) canvas.append(svgElement(layer));
  });

  renderLayerList();
  renderProperties();
  saveDesign();
}

function startDrag(event) {
  const layer = design.layers.find(item => item.id === event.currentTarget.dataset.id);
  if (!layer || layer.locked) return;

  selected = layer.id;
  dragging = {
    layer,
    pointerX: event.clientX,
    pointerY: event.clientY,
    layerX: Number(layer.x),
    layerY: Number(layer.y)
  };
  event.currentTarget.setPointerCapture(event.pointerId);
  renderLayerList();
  renderProperties();
}

$("#canvas").addEventListener("pointermove", event => {
  if (!dragging) return;
  const bounds = $("#canvas").getBoundingClientRect();
  dragging.layer.x = Math.round(
    dragging.layerX + (event.clientX - dragging.pointerX) * 800 / bounds.width
  );
  dragging.layer.y = Math.round(
    dragging.layerY + (event.clientY - dragging.pointerY) * 600 / bounds.height
  );
  renderEditor();
});
$("#canvas").addEventListener("pointerup", () => { dragging = null; });
$("#canvas").addEventListener("pointercancel", () => { dragging = null; });

function renderLayerList() {
  const list = $("#layers");
  list.replaceChildren();

  design.layers.forEach((layer, index) => {
    const row = document.createElement("li");
    row.className = layer.id === selected ? "selected" : "";

    const name = document.createElement("button");
    name.textContent = layer.name || layer.type;
    name.onclick = () => { selected = layer.id; renderEditor(); };

    const controls = document.createElement("span");
    controls.className = "layer-controls";

    const visibility = document.createElement("button");
    visibility.textContent = layer.visible ? "◉" : "○";
    visibility.title = "Afficher ou masquer";
    visibility.onclick = () => { layer.visible = !layer.visible; renderEditor(); };

    const lock = document.createElement("button");
    lock.textContent = layer.locked ? "🔒" : "🔓";
    lock.title = "Verrouiller ou déverrouiller";
    lock.onclick = () => { layer.locked = !layer.locked; renderEditor(); };

    const up = document.createElement("button");
    up.textContent = "↑";
    up.title = "Monter";
    up.onclick = () => {
      if (index < design.layers.length - 1) {
        [design.layers[index], design.layers[index + 1]] =
          [design.layers[index + 1], design.layers[index]];
        renderEditor();
      }
    };

    const down = document.createElement("button");
    down.textContent = "↓";
    down.title = "Descendre";
    down.onclick = () => {
      if (index > 0) {
        [design.layers[index], design.layers[index - 1]] =
          [design.layers[index - 1], design.layers[index]];
        renderEditor();
      }
    };

    controls.append(visibility, lock, up, down);
    row.append(name, controls);
    list.append(row);
  });
}

function renderProperties() {
  const box = $("#properties");
  box.replaceChildren();
  const layer = design.layers.find(item => item.id === selected);

  if (!layer) {
    box.textContent = "Sélectionnez un calque.";
    return;
  }

  const fields = [
    ["Nom", "name", "text"], ["X", "x", "number"], ["Y", "y", "number"],
    ["Largeur", "width", "number"], ["Hauteur", "height", "number"],
    ["Rotation", "rotation", "number"], ["Opacité (0–1)", "opacity", "number"],
    ["Couleur", "color", "color"], ["Contour", "stroke", "color"],
    ["Épaisseur du contour", "strokeWidth", "number"], ["Flou", "blur", "number"]
  ];

  if (layer.type === "text") {
    fields.push(
      ["Texte", "text", "text"], ["Police", "font", "text"],
      ["Taille du texte", "fontSize", "number"]
    );
  }

  fields.forEach(([label, key, type]) => {
    const row = document.createElement("label");
    row.append(document.createTextNode(label + " "));
    const input = document.createElement("input");
    input.type = type;
    input.value = layer[key] ?? "";
    if (key === "opacity") {
      input.min = 0; input.max = 1; input.step = 0.05;
    }
    input.oninput = () => {
      layer[key] = type === "number" ? Number(input.value) : input.value;
      renderEditor();
    };
    row.append(input);
    box.append(row);
  });

  if (layer.type === "text") {
    [["Gras", "bold"], ["Italique", "italic"]].forEach(([label, key]) => {
      const row = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = Boolean(layer[key]);
      input.onchange = () => { layer[key] = input.checked; renderEditor(); };
      row.append(input, document.createTextNode(" " + label));
      box.append(row);
    });
  }

  [["Ombre", "shadow"]].forEach(([label, key]) => {
    const row = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(layer[key]);
    input.onchange = () => { layer[key] = input.checked; renderEditor(); };
    row.append(input, document.createTextNode(" " + label));
    box.append(row);
  });
}

$("#background-color").oninput = event => {
  design.background = event.target.value;
  renderEditor();
};
$("#new-text").onclick = () => addLayer("text");
$("#new-rect").onclick = () => addLayer("rect");
$("#new-circle").onclick = () => addLayer("circle");

$("#delete-layer").onclick = () => {
  design.layers = design.layers.filter(layer => layer.id !== selected);
  selected = null;
  renderEditor();
};

$("#image-input").onchange = event => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => addLayer("image", {
    name: file.name, src: reader.result, width: 320, height: 220
  });
  reader.readAsDataURL(file);
  event.target.value = "";
};

function getSvg() {
  const copy = $("#canvas").cloneNode(true);
  copy.setAttribute("xmlns", svgNS);
  copy.setAttribute("width", "800");
  copy.setAttribute("height", "600");
  return new XMLSerializer().serializeToString(copy);
}

$("#export-svg").onclick = () =>
  download("mon-affiche.svg", getSvg(), "image/svg+xml");

$("#save-json").onclick = () =>
  download("mon-projet.json", JSON.stringify(design, null, 2), "application/json");

$("#json-input").onchange = event => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported.layers)) throw new Error();
      design = imported;
      selected = null;
      $("#background-color").value = design.background || "#ffffff";
      renderEditor();
    } catch {
      alert("Ce fichier JSON n’est pas un projet Mon Atelier valide.");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
};

$("#export-png").onclick = () => {
  const url = URL.createObjectURL(new Blob([getSvg()], { type: "image/svg+xml" }));
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    const context = canvas.getContext("2d");
    context.fillStyle = design.background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    canvas.toBlob(blob => {
      if (blob) download("mon-affiche.png", blob, "image/png");
      URL.revokeObjectURL(url);
    });
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    alert("L’export PNG a échoué.");
  };
  image.src = url;
};

// JSX Photoshop : formes rectangulaires et calques de texte simples.
$("#export-jsx").onclick = () => {
  const data = JSON.stringify(design.layers).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const jsx = `#target photoshop
app.bringToFront();
var layers = eval('(' + '${data}' + ')');
var doc = app.documents.add(800, 600, 72, "Mon affiche");
function colorFromHex(value) {
  var c = new SolidColor();
  c.rgb.hexValue = value.replace("#", "");
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
    t.textItem.color = colorFromHex(l.color || "#000000");
  } else if (l.type === "rect" || l.type === "circle") {
    var s = doc.artLayers.add();
    s.name = l.name || l.type;
    doc.selection.select([
      [Number(l.x), Number(l.y)],
      [Number(l.x) + Number(l.width), Number(l.y)],
      [Number(l.x) + Number(l.width), Number(l.y) + Number(l.height)],
      [Number(l.x), Number(l.y) + Number(l.height)]
    ]);
    doc.selection.fill(colorFromHex(l.color || "#2878d0"));
    doc.selection.deselect();
  }
}
`;
  download("mon-affiche.jsx", jsx, "text/plain");
};

document.querySelectorAll("[data-filter]").forEach(button => {
  button.onclick = () => {
    currentFilter = button.dataset.filter;
    renderTasks();
  };
});

$("#background-color").value = design.background || "#ffffff";
renderTasks();
renderEditor();
