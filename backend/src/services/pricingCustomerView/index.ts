import { QuotePricing, QuotePricingCharge, QuotePricingBlock } from "@prisma/client";
import { buildSeaLocalFreezoneBlocksView, buildSeaTransitBlocksView } from "./seaBlocks";
import { buildSeaExportLclView, buildSeaImportLclView } from "./seaLcl";
import { buildSeaImportLocalView } from "./seaImportLocal";
import { buildAirOrSea2AirView } from "./airAndSea2Air";
import { buildTransferOwnershipInfo } from "./transferOwnership";

export type BuildViewParams = {
  pricingRow: (QuotePricing & { charges: QuotePricingCharge[]; blocks: QuotePricingBlock[] }) | null;
  canSeeBreakdown: boolean;
  currencyFallback?: string;

  // ✅ NEW
  hiddenBreakdownCodes?: string[];
};

export function buildCustomerPricingView(params: BuildViewParams) {
  const { pricingRow, canSeeBreakdown, currencyFallback = "AED", hiddenBreakdownCodes } = params;

  const charges = pricingRow?.charges ?? [];
  const currency = (pricingRow?.currency as any) ?? currencyFallback;

  const too = buildTransferOwnershipInfo(charges, hiddenBreakdownCodes);

  if (pricingRow?.mode === "SEA") {
    if (
      (pricingRow.templateCode as any) === "SEA_EXPORT_LOCAL" ||
      (pricingRow.templateCode as any) === "SEA_EXPORT_FREEZONE"
    ) {
      return buildSeaLocalFreezoneBlocksView({
        pricingRow,
        canSeeBreakdown,
        currency,
        too,
        hiddenBreakdownCodes,
      });
    }

    if ((pricingRow.templateCode as any) === "SEA_EXPORT_TRANSIT") {
      return buildSeaTransitBlocksView({
        pricingRow,
        canSeeBreakdown,
        currency,
        too,
        hiddenBreakdownCodes,
      });
    }

    if ((pricingRow.templateCode as any) === "SEA_EXPORT_LCL") {
      return buildSeaExportLclView({
        pricingRow,
        canSeeBreakdown,
        currency,
        too,
        hiddenBreakdownCodes,
      });
    }

    if ((pricingRow.templateCode as any) === "SEA_IMPORT_LOCAL") {
      return buildSeaImportLocalView({
        pricingRow,
        canSeeBreakdown,
        currency,
        too,
        hiddenBreakdownCodes,
      });
    }

    if ((pricingRow.templateCode as any) === "SEA_IMPORT_LCL") {
      return buildSeaImportLclView({
        pricingRow,
        canSeeBreakdown,
        currency,
        too,
        hiddenBreakdownCodes,
      });
    }
  }

  // fallback: AIR + SEA→AIR
  return buildAirOrSea2AirView({
    pricingRow,
    canSeeBreakdown,
    currency,
    too,
    hiddenBreakdownCodes,
  });
}
