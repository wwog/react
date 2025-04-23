import React, { type FC, type ReactNode } from "react";

export interface IfProps {
  condition: boolean;
  children?: React.ReactNode;
}

export interface ThenProps {
  children?: React.ReactNode;
}

export interface ElseProps {
  children?: React.ReactNode;
}

export interface ElseIfProps {
  condition: boolean;
  children?: React.ReactNode;
}

const Then: FC<ThenProps> = (props) => {
  return <>{props.children}</>;
};
const Else: FC<ElseProps> = ({ children }) => {
  return <>{children}</>;
};
const ElseIf: FC<ElseIfProps> = (props) => {
  return <>{props.children}</>;
};
Then.displayName = "If_Then";
Else.displayName = "If_Else";
ElseIf.displayName = "If_ElseIf";

export const If = ({
  condition,
  children,
}: IfProps): React.ReactElement | null => {
  let thenChild: React.ReactElement<ThenProps> | null =
    null as React.ReactElement<ThenProps> | null;
  let elseChild: React.ReactElement<ElseProps> | null = null;
  const elseIfChildren: React.ReactElement<ElseIfProps>[] = [];

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) {
      throw new Error("If component only accepts valid React elements");
    }

    const type = child.type as any;

    if (type.displayName === Then.displayName) {
      if (thenChild) {
        throw new Error("If component can only have one Then child");
      }
      thenChild = child as React.ReactElement<ThenProps>;
    } else if (type.displayName === ElseIf.displayName) {
      elseIfChildren.push(child as React.ReactElement<ElseIfProps>);
    } else if (type.displayName === Else.displayName) {
      if (elseChild) {
        throw new Error("If component can only have one Else child");
      }
      elseChild = child as React.ReactElement<ElseProps>;
    } else {
      throw new Error(
        `If component only accepts 'Then', 'ElseIf', or 'Else' elements as children, found: ${String(
          type.displayName || type.name || type
        )}`
      );
    }
  });

  if (condition) {
    return thenChild ? <>{thenChild.props.children}</> : null;
  }

  for (const elseIf of elseIfChildren) {
    if (elseIf.props.condition) {
      return <>{elseIf.props.children}</>;
    }
  }

  if (elseChild) {
    return <>{(elseChild as React.ReactElement<ElseProps>).props.children}</>;
  }

  return null;
};

If.displayName = "If";
If.Then = Then;
If.ElseIf = ElseIf;
If.Else = Else;
If.createTyped = function () {
  return {
    If,
    Then,
    ElseIf,
    Else,
  } as {
    If: (props: IfProps) => React.ReactElement | null;
    Then: (props: ThenProps) => React.ReactElement;
    ElseIf: (props: ElseIfProps) => React.ReactElement;
    Else: (props: ElseProps) => React.ReactElement;
  };
};

export interface TrueProps {
  condition: boolean;
  children?: ReactNode;
}
export const True: FC<TrueProps> = ({ condition, children }) => {
  return condition ? <>{children}</> : null;
};

export interface FalseProps {
  condition: boolean;
  children?: ReactNode;
}
export const False: FC<FalseProps> = ({ condition, children }) => {
  return condition === false ? <>{children}</> : null;
};
