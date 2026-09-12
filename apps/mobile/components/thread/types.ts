import type { TextProps } from "react-native";
import type { PickedAttachment } from "../../lib/pick-attachments";

export type PendingAttachment = PickedAttachment & { threadKey: string };

export type MessageActionProps = Pick<
  TextProps,
  "onLongPress" | "accessibilityActions" | "onAccessibilityAction"
>;

export type BotAction = {
  text: string;
  destructive?: boolean;
  onPress: () => void;
};
