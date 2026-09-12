import { formatThreadTimestamp } from "@rakazo/core";
import { Text } from "react-native";
import { mobileTokens, typeScale } from "../../lib/appearance";
import { dateLocaleForUi } from "../../lib/i18n";

export function TimestampDivider({ createdAt }: { createdAt: string }) {
  const tokens = mobileTokens();
  return (
    <Text
      style={{
        width: "100%",
        textAlign: "center",
        color: tokens.mutedForeground,
        ...typeScale.caption,
        marginBottom: 6,
      }}
    >
      {formatThreadTimestamp(createdAt, new Date(), dateLocaleForUi())}
    </Text>
  );
}
