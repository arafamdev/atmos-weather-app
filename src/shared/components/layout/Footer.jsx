import AtmosBrand from "./AtmosBrand.jsx";

const socialLinks = [
  { label: "GitHub", accessibleName: "GitHub profile", iconId: "github-icon", href: "https://github.com/arafamdev" },
  { label: "LinkedIn (temporary)", accessibleName: "LinkedIn (temporary link)", iconId: "linkedin-icon", href: "https://www.linkedin.com/" },
];

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-10 border-t border-app-border pt-6 sm:mt-16 sm:pt-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <AtmosBrand />

        <nav aria-label="Social links">
          <ul className="flex flex-wrap items-center gap-3">
            {socialLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${link.accessibleName} (opens in a new tab)`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-app-muted hover:bg-app-surface hover:text-app-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent"
                >
                  <svg className="size-4 shrink-0" aria-hidden="true" focusable="false">
                    <use href={`${import.meta.env.BASE_URL}icons.svg#${link.iconId}`} />
                  </svg>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="mt-5 flex flex-col gap-2 text-xs text-app-muted sm:mt-6 sm:flex-row sm:justify-between">
        <p>© {currentYear} Atmos. All rights reserved.</p>
        <p>Developed by Arafam Mussa Silla.</p>
      </div>
    </footer>
  );
}

export default Footer;
