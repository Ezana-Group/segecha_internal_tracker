const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://okrjfhcwqebhrfcnnydw.supabase.co"
const SUPABASE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rcmpmaGN3cWViaHJmY25ueWR3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjgxNTUzOCwiZXhwIjoyMDg4MzkxNTM4fQ.QdL1AqkrU86YAopiMsTnlULWXFZ61WGNzoMmsal27GU"

const supabase = createClient(SUPABASE_URL, SUPABASE_ROLE_KEY);

async function main() {
    const { data, error } = await supabase.auth.admin.createUser({
        email: 'test@segechagroup.co.ke',
        password: 'password123',
        email_confirm: true
    });

    if (error) {
        console.error("Error creating user:", error);
    } else {
        console.log("Success! Created user:", data.user.email);
    }
}

main();
