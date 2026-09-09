const navigation = document.querySelector(".project-nav");
const menus = [...(navigation?.querySelectorAll(".project-menu") ?? [])];

for (const menu of menus) {
  menu.addEventListener("toggle", () => {
    if (menu.open) for (const other of menus) if (other !== menu) other.open = false;
  });
}

document.addEventListener("click", event => {
  for (const menu of menus) {
    if (!menu.contains(event.target) || event.target.closest("a")) menu.open = false;
  }
});
document.addEventListener("focusin", event => {
  for (const menu of menus) if (!menu.contains(event.target)) menu.open = false;
});
document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  const open = menus.find(menu => menu.open);
  if (!open) return;
  event.preventDefault();
  open.open = false;
  open.querySelector("summary").focus();
});

const filter = navigation?.querySelector("[data-case-filter]");
if (filter) filter.closest("label").hidden = false;
filter?.addEventListener("input", () => {
  const query = filter.value.trim().toLowerCase();
  let visible = 0;
  for (const group of navigation.querySelectorAll("[data-case-group]")) {
    let count = 0;
    for (const item of group.querySelectorAll("[data-case-search]")) {
      item.hidden = !item.dataset.caseSearch.includes(query);
      if (!item.hidden) count++;
    }
    group.hidden = count === 0;
    visible += count;
  }
  navigation.querySelector("[data-case-empty]").hidden = visible !== 0;
  navigation.querySelector("[data-case-count]").textContent = `${visible} ${visible === 1 ? "case" : "cases"} shown`;
});
