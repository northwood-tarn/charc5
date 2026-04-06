import React, { type ReactNode } from "react";

type Props = {
  title: string;
  helper?: ReactNode;
  children: ReactNode;
};

export default function SpellSelectionSection({ title, helper, children }: Props) {
  return (
    <div className="app-column">
      <div className="section-subtitle">{title}</div>
      {helper ? <div className="section-helper">{helper}</div> : null}
      {children}
    </div>
  );
}
