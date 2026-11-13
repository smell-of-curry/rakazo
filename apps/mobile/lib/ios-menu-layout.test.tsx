import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { GestureResponderEvent } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MessageContextMenu } from "../components/message-context-menu";
import { buildMessageContextMenu } from "./message-context-menu";

// Native primitives are mocked: these assertions cover the bridge contract and
// actions, not SwiftUI geometry. Actual iOS overlap still needs device validation.
const captures = vi.hoisted(() => ({
  os: "ios",
  host: {} as Record<string, unknown>,
  trigger: {} as Record<string, unknown>,
  view: {} as Record<string, unknown>,
  buttons: [] as { label: string; onPress: () => void }[],
  sections: [] as string[],
  menus: [] as string[],
}));
vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return captures.os;
    },
  },
  Pressable: ({ children }: { children: ReactNode }) => children,
  View: (props: Record<string, unknown>) => {
    captures.view = props;
    return props.children;
  },
}));
vi.mock("@expo/ui/swift-ui", () => {
  const passthrough = ({ children }: { children: ReactNode }) => children;
  return {
    Host: (props: Record<string, unknown>) => {
      captures.host = props;
      return props.children;
    },
    RNHostView: (props: Record<string, unknown>) => {
      captures.trigger = props;
      return props.children;
    },
    ContextMenu: Object.assign(passthrough, { Trigger: passthrough, Items: passthrough }),
    Button: (props: { label: string; onPress: () => void }) => {
      captures.buttons.push(props);
      return null;
    },
    Menu: (props: { label: string; children: ReactNode }) => {
      captures.menus.push(props.label);
      return props.children;
    },
    Section: (props: { title: string; children: ReactNode }) => {
      captures.sections.push(props.title);
      return props.children;
    },
  };
});

const actions = buildMessageContextMenu({
  labels: {
    reply: "Reply",
    copy: "Copy",
    react: "React",
    quote: "Quote",
    speak: "Speak",
    select: "Select",
    unread: "Unread",
  },
  reactions: ["👍", "❤️"],
  include: { quote: true, react: true, speak: true, select: true, unread: true },
});

function renderMenu(onAction = vi.fn(), onDoubleTap = vi.fn()) {
  renderToStaticMarkup(
    <MessageContextMenu
      actions={actions}
      colorScheme="light"
      maxWidth={320}
      onAction={onAction}
      onDoubleTap={onDoubleTap}
    >
      <span>Completed helper</span>
    </MessageContextMenu>,
  );
}

beforeEach(() => {
  captures.os = "ios";
  captures.host = {};
  captures.buttons = [];
  captures.sections = [];
  captures.menus = [];
});

describe("iOS message menu layout", () => {
  it("reports changing trigger height without taking over the width", () => {
    renderMenu();
    expect(captures.host.matchContents).toEqual({ vertical: true });
    expect(captures.host.style).toEqual({ maxWidth: "100%", flexShrink: 1 });
    expect(captures.trigger.matchContents).toBe(true);
    expect(captures.trigger.boundedByHost).toBe(true);
    expect(captures.view.style).toEqual({ maxWidth: 320, width: undefined, flexShrink: 1 });
  });

  it("preserves inline secondary actions and reaction submenu selection", () => {
    const onAction = vi.fn();
    renderMenu(onAction);
    expect(captures.menus).toEqual(["React"]);
    expect(captures.sections).toEqual([""]);
    expect(captures.buttons.map((button) => button.label)).toEqual([
      "Reply",
      "Unread",
      "Copy",
      "👍",
      "❤️",
      "Quote",
      "Speak",
      "Select",
    ]);
    captures.buttons.find((button) => button.label === "❤️")?.onPress();
    captures.buttons.find((button) => button.label === "Copy")?.onPress();
    expect(onAction.mock.calls).toEqual([["reaction:❤️"], ["copy"]]);
  });

  it("retains double-tap responders on the trigger", () => {
    const onDoubleTap = vi.fn();
    renderMenu(vi.fn(), onDoubleTap);
    const grant = captures.view.onResponderGrant as (event: GestureResponderEvent) => void;
    const release = captures.view.onResponderRelease as typeof grant;
    const event = (timestamp: number) =>
      ({ nativeEvent: { pageX: 20, pageY: 20, timestamp } }) as GestureResponderEvent;
    grant(event(100));
    release(event(120));
    grant(event(200));
    release(event(220));
    expect(onDoubleTap).toHaveBeenCalledOnce();
  });

  it("keeps the non-iOS pressable path outside the SwiftUI host", () => {
    captures.os = "android";
    renderMenu();
    expect(captures.host).toEqual({});
    expect(captures.buttons).toEqual([]);
  });
});
