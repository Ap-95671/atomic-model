import { $ } from "./dom";
let modalReturnFocus: HTMLElement | null = null;
export function initializeDialog() {
  $("close-dialog").onclick = closeModal;
$("dialog").addEventListener("click", (e) => {
  if (e.target === $("dialog")) closeModal();
});
$("dialog").addEventListener("close", () => modalReturnFocus?.focus());

}
export function modal(title: string, body: string, kicker = "EXPLORE") {
  if (!$<HTMLDialogElement>("dialog").open)
    modalReturnFocus = document.activeElement as HTMLElement;
  $("dialog-title").textContent = title;
  $("dialog-kicker").textContent = kicker;
  $("dialog-body").innerHTML = body;
  if (!$<HTMLDialogElement>("dialog").open)
    $<HTMLDialogElement>("dialog").showModal();
}
export function closeModal() {
  $<HTMLDialogElement>("dialog").close();
  modalReturnFocus?.focus();
}
