export function PageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <div className="page-kicker">{kicker}</div>
        <h1 className="page-title">{title}</h1>
        {description ? <div className="page-desc">{description}</div> : null}
      </div>

      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}