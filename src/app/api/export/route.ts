import { getUser } from "@/lib/auth";
import { exportUserData } from "@/lib/user-data";

/** Downloads everything the signed-in user owns as one JSON file. */
export async function GET() {
  const user = await getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const data = await exportUserData(user.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="timeo-export-${user.today}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
