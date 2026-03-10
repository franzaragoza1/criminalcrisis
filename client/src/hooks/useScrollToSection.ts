export function useScrollToSection() {
  return (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      const headerHeight = 72;
      const y = el.getBoundingClientRect().top + window.scrollY - headerHeight;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };
}
