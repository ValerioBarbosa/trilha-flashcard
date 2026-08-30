export function EmptyFeature({ title, text }: { title: string; text: string }) {
  return <div className="empty-feature"><div className="empty-icon">＋</div><h2>{title}</h2><p>{text}</p></div>;
}
