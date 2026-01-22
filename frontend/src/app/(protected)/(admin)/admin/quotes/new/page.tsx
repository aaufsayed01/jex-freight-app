"use client";

import { useState } from "react";
import axios, { AxiosError } from "axios";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

type ShipmentMode = "AIR" | "SEA";

type PackageRow = {
  qty: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
};

export default function AdminQuoteCreatePage() {
  const user = useAuthStore((s) => s.user);
  const isStaff = user?.role === "ADMIN" || user?.role === "INTERNAL_STAFF";

  const [companyId, setCompanyId] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [shipmentMode, setShipmentMode] = useState<ShipmentMode>("AIR");
  const [commodity, setCommodity] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [pieces, setPieces] = useState("");

  const [isHazmat, setIsHazmat] = useState(false);
  const [isFragile, setIsFragile] = useState(false);
  const [isTemperatureControlled, setIsTemperatureControlled] = useState(false);

  const [docType, setDocType] = useState("");

  const [packages, setPackages] = useState<PackageRow[]>([
    { qty: "", lengthCm: "", widthCm: "", heightCm: "" },
  ]);

  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  if (!isStaff) {
    return <div className="p-6">Unauthorized</div>;
  }

  function updatePkg(i: number, key: keyof PackageRow, value: string) {
    setPackages((p) =>
      p.map((row, idx) => (idx === i ? { ...row, [key]: value } : row))
    );
  }

  function addPackageRow() {
    setPackages((p) => [
      ...p,
      { qty: "", lengthCm: "", widthCm: "", heightCm: "" },
    ]);
  }

  function removePackageRow(i: number) {
    setPackages((p) => p.filter((_, idx) => idx !== i));
  }

  async function submit() {
    setLoading(true);
    setErrMsg(null);
    setOkMsg(null);

    if (!companyId) {
      setErrMsg("Please select a company");
      setLoading(false);
      return;
    }

    try {
      const fd = new FormData();

      fd.append("companyId", companyId);
      fd.append("origin", origin);
      fd.append("destination", destination);
      fd.append("shipmentMode", shipmentMode);

      if (commodity) fd.append("commodity", commodity);
      if (weightKg) fd.append("weightKg", weightKg);
      if (pieces) fd.append("pieces", pieces);

      // booleans come as strings in multipart/form-data (backend will cast safely)
      fd.append("isHazmat", String(isHazmat));
      fd.append("isFragile", String(isFragile));
      fd.append("isTemperatureControlled", String(isTemperatureControlled));

      const packagesPayload = packages
        .filter((p) => p.qty && p.lengthCm && p.widthCm && p.heightCm)
        .map((p) => ({
          qty: Number(p.qty),
          lengthCm: Number(p.lengthCm),
          widthCm: Number(p.widthCm),
          heightCm: Number(p.heightCm),
        }));

      if (packagesPayload.length > 0) {
        fd.append("packages", JSON.stringify(packagesPayload));
      }

      // Optional free-text type (backend will map to OTHER/customType)
      if (files.length > 0 && docType.trim()) {
        fd.append("type", docType.trim());
      }

      files.forEach((f) => fd.append("files", f));

      const res = await api.post("/quotes", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setOkMsg(
        `Quote created successfully (ID: ${res.data?.quote?.id ?? "OK"})`
      );
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const ax = error as AxiosError<{ error?: string; message?: string }>;
        setErrMsg(
          ax.response?.data?.error ??
            ax.response?.data?.message ??
            "Failed to create quote"
        );
      } else {
        setErrMsg("Failed to create quote");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold">Create Quote (Admin / Staff)</h1>

      {errMsg && (
        <div className="bg-red-50 border border-red-200 p-3 text-red-700 rounded">
          {errMsg}
        </div>
      )}
      {okMsg && (
        <div className="bg-green-50 border border-green-200 p-3 text-green-700 rounded">
          {okMsg}
        </div>
      )}

      {/* Company picker */}
      <CompanyPicker value={companyId} onChange={setCompanyId} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Origin"
          id="origin"
          value={origin}
          onChange={setOrigin}
          placeholder="Dubai, UAE"
        />
        <Input
          label="Destination"
          id="destination"
          value={destination}
          onChange={setDestination}
          placeholder="Riyadh, KSA"
        />
        <Input
          label="Commodity"
          id="commodity"
          value={commodity}
          onChange={setCommodity}
          placeholder="General Cargo"
        />
        <Input
          label="Weight (kg)"
          id="weightKg"
          value={weightKg}
          onChange={setWeightKg}
          type="number"
          placeholder="150"
        />
        <Input
          label="Pieces"
          id="pieces"
          value={pieces}
          onChange={setPieces}
          type="number"
          placeholder="47"
        />
      </div>

      <div>
        <label className="text-sm" htmlFor="shipmentMode">
          Shipment Mode
        </label>
        <select
          id="shipmentMode"
          aria-label="Shipment Mode"
          title="Shipment Mode"
          className="w-full border rounded px-3 py-2"
          value={shipmentMode}
          onChange={(e) => setShipmentMode(e.target.value as ShipmentMode)}
        >
          <option value="AIR">AIR</option>
          <option value="SEA">SEA</option>
        </select>
      </div>

      {/* Option A: Checkboxes */}
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isHazmat}
            onChange={(e) => setIsHazmat(e.target.checked)}
          />
          Hazmat
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isFragile}
            onChange={(e) => setIsFragile(e.target.checked)}
          />
          Fragile
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isTemperatureControlled}
            onChange={(e) => setIsTemperatureControlled(e.target.checked)}
          />
          Temperature controlled
        </label>
      </div>

      {/* Dimensions */}
      <div className="border rounded p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="font-medium">Dimensions</span>
          <button
            type="button"
            onClick={addPackageRow}
            className="text-sm border px-3 py-1 rounded"
          >
            + Add
          </button>
        </div>

        {packages.map((p, i) => (
          <div key={i} className="grid grid-cols-5 gap-2 items-center">
            <input
              className="w-full border rounded px-2 py-2"
              aria-label="Quantity"
              placeholder="Qty"
              value={p.qty}
              onChange={(e) => updatePkg(i, "qty", e.target.value)}
            />
            <input
              className="w-full border rounded px-2 py-2"
              aria-label="Length in cm"
              placeholder="L (cm)"
              value={p.lengthCm}
              onChange={(e) => updatePkg(i, "lengthCm", e.target.value)}
            />
            <input
              className="w-full border rounded px-2 py-2"
              aria-label="Width in cm"
              placeholder="W (cm)"
              value={p.widthCm}
              onChange={(e) => updatePkg(i, "widthCm", e.target.value)}
            />
            <input
              className="w-full border rounded px-2 py-2"
              aria-label="Height in cm"
              placeholder="H (cm)"
              value={p.heightCm}
              onChange={(e) => updatePkg(i, "heightCm", e.target.value)}
            />

            <button
              type="button"
              onClick={() => removePackageRow(i)}
              className="border rounded px-3 py-2"
              disabled={packages.length === 1}
              aria-label="Remove dimension row"
              title="Remove dimension row"
            >
              ✕
            </button>
          </div>
        ))}

        <div className="text-xs text-gray-500">
          Chargeable weight will be calculated automatically from dimensions.
        </div>
      </div>

      <Input
        label="Document Type (optional)"
        id="docType"
        value={docType}
        onChange={setDocType}
        placeholder="Packing List / Invoice / Any text"
      />

      <div>
        <label className="text-sm" htmlFor="filesInput">
          Upload Documents (optional)
        </label>
        <input
          id="filesInput"
          aria-label="Upload documents"
          type="file"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={loading}
        className="bg-black text-white px-6 py-2 rounded disabled:opacity-50"
      >
        {loading ? "Submitting..." : "Create Quote"}
      </button>
    </div>
  );
}

/* ---------------- helpers ---------------- */

function Input({
  label,
  id,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-sm" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="w-full border rounded px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        placeholder={placeholder}
      />
    </div>
  );
}

function CompanyPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Array<{ id: string; name: string; type?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function search() {
    setLoading(true);
    setErrMsg(null);
    try {
      const res = await api.get(`/companies?search=${encodeURIComponent(q)}`);
      setItems(res.data ?? []);
    } catch {
      setErrMsg("Failed to load companies");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border rounded p-4 space-y-2">
      <label className="text-sm" htmlFor="companySearch">
        Customer Company
      </label>

      <div className="flex gap-2">
        <input
          id="companySearch"
          aria-label="Company search"
          className="border rounded px-3 py-2 flex-1"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type company name..."
        />
        <button
          type="button"
          onClick={search}
          className="border rounded px-3 py-2"
          disabled={loading}
        >
          {loading ? "..." : "Search"}
        </button>
      </div>

      {errMsg && <div className="text-sm text-red-600">{errMsg}</div>}

      <label className="text-sm" htmlFor="companySelect">
        Select company
      </label>
      <select
        id="companySelect"
        aria-label="Select company"
        title="Select company"
        className="w-full border rounded px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">-- select --</option>
        {items.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.type ? ` (${c.type})` : ""}
          </option>
        ))}
      </select>

      {value && <div className="text-xs text-gray-500">Selected: {value}</div>}
    </div>
  );
}

