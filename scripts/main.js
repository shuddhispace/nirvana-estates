// scripts/main.js
document.addEventListener('DOMContentLoaded', function () {
  const toggle = document.getElementById('mobile-menu-toggle');
  const menu = document.getElementById('mobile-menu');

  toggle.addEventListener('click', () => {
    menu.classList.toggle('hidden');
  });
});
