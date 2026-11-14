const eventCopyEditor = (() => {
  const allowedTags = new Set(["P", "DIV", "BR", "H3", "H4", "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "UL", "OL", "LI"]);
  const ignoredTags = new Set(["SCRIPT", "STYLE", "TEMPLATE", "IFRAME", "OBJECT", "EMBED", "SVG", "MATH"]);
  const controls = [
    ["formatBlock", "p", "Parágrafo", "¶"],
    ["formatBlock", "h3", "Título", "T"],
    ["bold", "", "Negrito", "<strong>N</strong>"],
    ["italic", "", "Itálico", "<em>I</em>"],
    ["underline", "", "Sublinhado", "<u>S</u>"],
    ["strikeThrough", "", "Tachado", "<s>T</s>"],
    ["insertUnorderedList", "", "Lista com marcadores", "• Lista"],
    ["insertOrderedList", "", "Lista numerada", "1. Lista"],
    ["undo", "", "Desfazer", "↶"],
    ["redo", "", "Refazer", "↷"],
  ];

  function clean(html) {
    const input = document.createElement("template");
    input.innerHTML = html;
    const output = document.createElement("div");
    function append(node, parent) {
      if (node.nodeType === Node.TEXT_NODE) {
        parent.append(node.textContent);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE || ignoredTags.has(node.tagName)) return;
      const target = allowedTags.has(node.tagName) ? document.createElement(node.tagName) : parent;
      if (target !== parent) parent.append(target);
      for (const child of node.childNodes) append(child, target);
    }
    for (const child of input.content.childNodes) append(child, output);
    return output.innerHTML;
  }

  function fromText(text = "") {
    return text ? text.split(/\r?\n\r?\n/).map((paragraph) =>
      `<p>${esc(paragraph).replace(/\r?\n/g, "<br>") || "<br>"}</p>`).join("") : "";
  }

  function fromTemplate(text) {
    return text.split("\n\n").map((block) => {
      if (block.startsWith("## ")) return `<h3>${esc(block.slice(3))}</h3>`;
      if (block.startsWith("- ")) return `<ul>${block.split("\n").map((line) => `<li>${esc(line.slice(2))}</li>`).join("")}</ul>`;
      return fromText(block);
    }).join("");
  }

  function read(root) {
    const notes = root.innerText.replaceAll("\u00a0", " ").trim();
    if (notes.length > 5000) throw new Error("A copy pode ter até 5.000 caracteres.");
    return { notes, notesHtml: notes ? clean(root.innerHTML) : "" };
  }

  function mount(container, item) {
    container.innerHTML = `<div class="copy-editor-label" id="event-copy-label">Copy da mensagem</div>
      <div class="copy-editor-tools" role="group" aria-label="Formatação da copy">
        ${controls.map(([, , label, icon], index) => `<button class="button small" type="button" data-copy-command="${index}"
          aria-label="${label}" title="${label}">${icon}</button>`).join("")}
      </div>
      <div class="copy-editor-body copy-content" id="event-copy-body" contenteditable="true" role="textbox"
        aria-multiline="true" aria-labelledby="event-copy-label" spellcheck="true"></div>`;
    const root = $("#event-copy-body", container);
    const toolbar = $(".copy-editor-tools", container);
    root.innerHTML = item?.notesHtml ? clean(item.notesHtml) : fromText(item?.notes);
    let savedRange;
    const rememberSelection = () => {
      const selection = window.getSelection();
      if (selection.rangeCount && root.contains(selection.anchorNode) && root.contains(selection.focusNode)) {
        savedRange = selection.getRangeAt(0).cloneRange();
      }
    };
    root.addEventListener("blur", rememberSelection);
    toolbar.addEventListener("mousedown", (event) => {
      if (event.target.closest("[data-copy-command]")) event.preventDefault();
    });
    toolbar.addEventListener("click", (event) => {
      const button = event.target.closest("[data-copy-command]");
      if (!button) return;
      const [command, value] = controls[Number(button.dataset.copyCommand)];
      rememberSelection();
      root.focus();
      if (savedRange && root.contains(savedRange.commonAncestorContainer)) {
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(savedRange);
      }
      document.execCommand("styleWithCSS", false, false);
      document.execCommand(command, false, value);
      rememberSelection();
    });
    root.addEventListener("paste", (event) => {
      event.preventDefault();
      const clipboard = event.clipboardData;
      if (!clipboard) return;
      const formatted = clean(clipboard.getData("text/html"));
      document.execCommand("insertHTML", false, formatted || fromText(clipboard.getData("text/plain")));
    });
    root.addEventListener("drop", (event) => event.preventDefault());
    return root;
  }

  return { clean, fromText, fromTemplate, mount, read };
})();
