import { useCallback, useRef } from "react";
import { DialogShell } from "../DialogShell";
import {
  documentationSections,
  type DocSection,
} from "../../help/documentationContent";
import { formatShortcut, shortcutGroups } from "../../shortcuts";

interface DocumentationDialogProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS_SECTION_ID = "keyboard-shortcuts";

function DocSectionBody({ section }: { section: DocSection }) {
  return (
    <>
      {section.blocks.map((block, index) =>
        block.kind === "paragraph" ? (
          <p key={index} className="fo-documentation-paragraph">
            {block.text}
          </p>
        ) : (
          <ul key={index} className="fo-documentation-list">
            {block.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ),
      )}
    </>
  );
}

export function DocumentationDialog({
  open,
  onClose,
}: DocumentationDialogProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  const scrollToSection = useCallback((id: string) => {
    const container = contentRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>(`#fo-doc-${id}`);
    target?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, []);

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title="Documentation"
      titleId="documentation-title"
      subtitle="How to get around FileOctopus and run common tasks."
      size="lg"
      className="fo-documentation-dialog"
    >
      <div className="fo-dialog-body">
        <div className="fo-documentation-layout">
          <nav
            className="fo-documentation-toc"
            aria-label="Documentation sections"
          >
            <ul>
              {documentationSections.map((section) => (
                <li key={section.id}>
                  <button
                    type="button"
                    className="fo-documentation-toc-link"
                    onClick={() => scrollToSection(section.id)}
                  >
                    {section.title}
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  className="fo-documentation-toc-link"
                  onClick={() => scrollToSection(SHORTCUTS_SECTION_ID)}
                >
                  Keyboard shortcuts
                </button>
              </li>
            </ul>
          </nav>
          <div
            className="fo-documentation-content"
            ref={contentRef}
            tabIndex={0}
          >
            {documentationSections.map((section) => (
              <section
                key={section.id}
                id={`fo-doc-${section.id}`}
                className="fo-documentation-section"
              >
                <h3 className="fo-dialog-section-title">{section.title}</h3>
                <DocSectionBody section={section} />
              </section>
            ))}
            <section
              id={`fo-doc-${SHORTCUTS_SECTION_ID}`}
              className="fo-documentation-section"
            >
              <h3 className="fo-dialog-section-title">Keyboard shortcuts</h3>
              <div className="fo-shortcuts-groups">
                {shortcutGroups.map((group) => (
                  <section key={group.title} className="fo-shortcuts-group">
                    <h4 className="fo-dialog-section-title">{group.title}</h4>
                    <table className="fo-shortcuts-table">
                      <tbody>
                        {group.entries.map((entry) => (
                          <tr key={entry.id}>
                            <td>{entry.label}</td>
                            <td>
                              <kbd>{formatShortcut(entry)}</kbd>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </DialogShell>
  );
}
