"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Download, FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { importMembers, type ImportSummary } from "@/features/import/actions";
import { parseCsv } from "@/lib/csv";
import { mapRow, templateCsv } from "@/lib/import";

export function MemberImport() {
  const [rows, setRows] = React.useState<Record<string, string>[] | null>(null);
  const [fileName, setFileName] = React.useState("");
  const [skipDup, setSkipDup] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<ImportSummary | null>(null);

  const onFile = async (file: File) => {
    setResult(null);
    if (file.size > 5 * 1024 * 1024) return toast.error("File is too large (max 5 MB).");
    const text = await file.text();
    const parsed = parseCsv(text);
    const mapped = parsed.rows.map(mapRow).filter((r) => Object.keys(r).length > 0);
    if (!mapped.length) return toast.error("No rows found. Make sure the first row has column headers.");
    if (!mapped.some((r) => r.first_name)) return toast.error("Couldn't find a first_name (or name) column.");
    setFileName(file.name);
    setRows(mapped);
  };

  const run = async () => {
    if (!rows) return;
    setBusy(true);
    try {
      const res = await importMembers(rows, skipDup);
      if (res.ok && res.data) {
        setResult(res.data);
        toast.success(`Imported ${res.data.inserted} members`);
      } else if (!res.ok) toast.error(res.error);
    } catch {
      toast.error("Network problem — the import may not have completed. Check the members list before retrying.");
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([templateCsv()], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "churchx-members-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const preview = rows?.slice(0, 5) ?? [];
  const cols = ["first_name", "last_name", "phone", "email", "gender", "membership_status", "join_date"];

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>1. Prepare your spreadsheet</CardTitle>
            <CardDescription className="mt-1">
              Save it as CSV. Recognised columns include first_name, last_name, phone, email, gender, date_of_birth (DD/MM/YYYY), membership_status and join_date. A single “name” column also works.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={downloadTemplate}>
            <Download /> Download template
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>2. Upload and check</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center hover:bg-muted has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
            <FileUp className="size-6 text-primary" aria-hidden />
            <span className="font-medium">{fileName || "Choose a CSV file"}</span>
            <span className="text-xs text-muted-foreground">Up to 2,000 rows per import</span>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
          {rows && (
            <>
              <p className="text-sm">
                Found <strong>{rows.length}</strong> rows. Preview:
              </p>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {cols.map((c) => (
                        <TableHead key={c}>{c}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((r, i) => (
                      <TableRow key={i}>
                        {cols.map((c) => (
                          <TableCell key={c} className="whitespace-nowrap">
                            {r[c] ?? <span className="text-muted-foreground">—</span>}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="skipdup" checked={skipDup} onCheckedChange={(c) => setSkipDup(c === true)} />
                <Label htmlFor="skipdup">Skip people whose phone or email already exists</Label>
              </div>
              <Button onClick={run} disabled={busy} className="w-fit">
                {busy && <Loader2 className="animate-spin" />} Import {rows.length} members
              </Button>
            </>
          )}
        </CardContent>
      </Card>
      {result && (
        <Card>
          <CardHeader>
            <CardTitle>
              <CheckCircle2 className="size-5 text-success" aria-hidden /> Import finished
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm" role="status">
            <p>
              <strong>{result.inserted}</strong> imported · <strong>{result.skipped}</strong> skipped as duplicates · <strong>{result.errors.length}</strong> rows with problems
            </p>
            {result.errors.length > 0 && (
              <ul className="max-h-64 overflow-y-auto rounded-md border p-3 text-xs">
                {result.errors.map((e) => (
                  <li key={`${e.row}-${e.message}`}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            )}
            <Button asChild variant="outline" className="w-fit">
              <Link href="/members">View members</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
