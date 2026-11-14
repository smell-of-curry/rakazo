import type { ButtonProps } from "@expo/ui/swift-ui";
import { Button, ContextMenu, Host, Menu, RNHostView, Section } from "@expo/ui/swift-ui";
import type { ReactNode } from "react";
import { useMemo } from "react";
import type { ColorSchemeName, GestureResponderEvent } from "react-native";
import { Platform, Pressable, View } from "react-native";
import { createDoubleTapDetector } from "../lib/double-tap";
import type { MessageMenuEntry, MessageMenuSymbol } from "../lib/message-context-menu";

const symbols = {
  reply: "arrowshape.turn.up.left",
  copy: "doc.on.doc",
  react: "face.smiling",
  quote: "text.quote",
  speak: "speaker.wave.2",
  select: "character.cursor.ibeam",
  unread: "message.badge",
} as const satisfies Record<MessageMenuSymbol, NonNullable<ButtonProps["systemImage"]>>;

const tapPoint = (event: GestureResponderEvent) => ({
  x: event.nativeEvent.pageX,
  y: event.nativeEvent.pageY,
  time: event.nativeEvent.timestamp,
});

export function MessageContextMenu({
  actions,
  children,
  colorScheme,
  maxWidth,
  fullWidth = false,
  onAction,
  onLongPress,
  onDoubleTap,
}: {
  actions: readonly MessageMenuEntry[];
  children: ReactNode;
  colorScheme: ColorSchemeName;
  maxWidth: number;
  fullWidth?: boolean;
  onAction: (id: string) => void;
  onLongPress?: (event: GestureResponderEvent) => void;
  /** Double tapping the message, used to react with a thumbs up. */
  onDoubleTap?: () => void;
}) {
  const detector = useMemo(() => createDoubleTapDetector(), [onDoubleTap]);
  // Touches reach these handlers only when no inner link, image or control claimed them,
  // so inner taps stay immediate and never count toward a double tap.
  const release = (event: GestureResponderEvent) => {
    if (detector.end(tapPoint(event))) onDoubleTap?.();
  };
  if (Platform.OS !== "ios") {
    return (
      <Pressable
        accessible={false}
        onLongPress={onLongPress}
        onPressIn={onDoubleTap ? (event) => detector.start(tapPoint(event)) : undefined}
        // A touch that slides is not a tap, so movement and cancellation end it here
        // as they do in the iOS responder below.
        onTouchMove={onDoubleTap ? (event) => detector.move(tapPoint(event)) : undefined}
        onTouchCancel={onDoubleTap ? () => detector.cancel() : undefined}
        onPress={onDoubleTap ? release : undefined}
        style={{ maxWidth: "100%", width: fullWidth ? maxWidth : undefined, flexShrink: 1 }}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <Host
      colorScheme={colorScheme ?? undefined}
      // The row must reserve the trigger height after wrapping, helper completion or expansion.
      matchContents={{ vertical: true }}
      ignoreSafeArea="all"
      style={{ maxWidth: "100%", flexShrink: 1 }}
    >
      <ContextMenu>
        <ContextMenu.Trigger>
          {/* Do not cap content at the previous host height: apps/helpers resize after mount.
              The inner View supplies the horizontal constraint without a vertical ceiling. */}
          <RNHostView matchContents>
            {/* The SwiftUI bridge measures its trigger without a horizontal constraint. */}
            <View
              style={{ maxWidth, width: fullWidth ? maxWidth : undefined, flexShrink: 1 }}
              onStartShouldSetResponder={() => Boolean(onDoubleTap)}
              onResponderGrant={(event) => detector.start(tapPoint(event))}
              onResponderMove={(event) => detector.move(tapPoint(event))}
              onResponderRelease={release}
              onResponderTerminationRequest={() => true}
              onResponderTerminate={() => detector.cancel()}
            >
              {children}
            </View>
          </RNHostView>
        </ContextMenu.Trigger>
        <ContextMenu.Items>
          {actions.map((entry) => renderMenuEntry(entry, onAction))}
        </ContextMenu.Items>
      </ContextMenu>
    </Host>
  );
}

function renderMenuEntry(entry: MessageMenuEntry, onAction: (id: string) => void): ReactNode {
  const image = entry.symbol ? symbols[entry.symbol] : undefined;
  if (entry.subactions?.length) {
    const items = entry.subactions.map((child) => renderMenuEntry(child, onAction));
    return entry.displayInline ? (
      <Section key={entry.id} title={entry.title}>
        {items}
      </Section>
    ) : (
      <Menu key={entry.id} label={entry.title} systemImage={image}>
        {items}
      </Menu>
    );
  }
  return (
    <Button
      key={entry.id}
      label={entry.title}
      systemImage={image}
      onPress={() => onAction(entry.id)}
    />
  );
}
