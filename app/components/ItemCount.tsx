interface ItemCountProps {
  count: number;
  singularLabel?: string;
  pluralLabel?: string;
}

export function ItemCount({ 
  count, 
  singularLabel = "item", 
  pluralLabel = "items" 
}: ItemCountProps) {
  return (
    <div className="mt-6 text-center text-sm text-slate-500">
      {count} {count !== 1 ? pluralLabel : singularLabel} in this directory
    </div>
  );
}

