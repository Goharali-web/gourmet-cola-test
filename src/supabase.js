/* ==========================================================================
   SUPABASE CLIENT CONFIGURATION
   Project: Gourmet Cola Animated Website
   ========================================================================== */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://vnusujqeocswefhxkqsu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_0xg5eRbG1qkIB0COSnoaAw_BxscXbOL';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* --------------------------------------------------------------------------
   saveOrder — Inserts an order record into the `orders` table
   -------------------------------------------------------------------------- */
export async function saveOrder(orderData) {
  const localId = 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const now = new Date().toISOString();

  const newOrder = {
    id:         localId,
    full_name:  orderData.fullName,
    email:      orderData.email,
    phone:      orderData.phone,
    address:    orderData.address,
    city:       orderData.city,
    pack_type:  orderData.packType,
    pack_price: orderData.packPrice,
    quantity:   orderData.quantity,
    notes:      orderData.notes || null,
    status:     'Pending',
    created_at: now,
  };

  // 1. Insert into Supabase — throws on error so UI can show the real message
  const { data, error } = await supabase
    .from('orders')
    .insert([
      {
        full_name:  newOrder.full_name,
        email:      newOrder.email,
        phone:      newOrder.phone,
        address:    newOrder.address,
        city:       newOrder.city,
        pack_type:  newOrder.pack_type,
        pack_price: newOrder.pack_price,
        quantity:   newOrder.quantity,
        notes:      newOrder.notes,
        status:     'Pending',
        created_at: now,
      }
    ])
    .select('*');

  if (error) {
    // Log full error for debugging
    console.error('Supabase saveOrder error:', JSON.stringify(error));
    throw new Error(`Database error (${error.code}): ${error.message || 'Could not save order to database.'}`);
  }

  // Use Supabase-generated id if available
  if (data && data.length > 0) {
    newOrder.id = data[0].id || localId;
  }

  // 2. Also cache locally for admin panel fallback
  try {
    const local = JSON.parse(localStorage.getItem('gourmet_orders') || '[]');
    local.unshift(newOrder);
    localStorage.setItem('gourmet_orders', JSON.stringify(local));
  } catch (_) {}

  return newOrder;
}


/* --------------------------------------------------------------------------
   saveNewsletterSubscriber — Inserts a subscriber into `newsletter_subscribers`
   -------------------------------------------------------------------------- */
export async function saveNewsletterSubscriber(email) {
  const { data, error } = await supabase
    .from('newsletter_subscribers')
    .insert([
      {
        email:      email,
        subscribed_at: new Date().toISOString(),
      }
    ]);

  if (error) {
    // Ignore duplicate email errors gracefully
    if (error.code === '23505') return { duplicate: true };
    throw error;
  }
  return data;
}

/* --------------------------------------------------------------------------
   ADMIN & BOOKINGS MANAGEMENT API
   -------------------------------------------------------------------------- */

// Password hashing utility using Web Crypto API SHA-256
export async function hashPassword(plainText) {
  const msgUint8 = new TextEncoder().encode(plainText);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/* --------------------------------------------------------------------------
   fetchOrders — Retrieves all customer bookings/orders
   -------------------------------------------------------------------------- */
export async function fetchOrders() {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetchOrders notice:', error.message);
      // Fallback to local storage cache if table does not exist or network issue
      const local = JSON.parse(localStorage.getItem('gourmet_orders') || '[]');
      return local;
    }

    // Also sync local cache
    if (data) {
      localStorage.setItem('gourmet_orders', JSON.stringify(data));
    }
    return data || [];
  } catch (err) {
    console.error('Error fetching orders:', err);
    return JSON.parse(localStorage.getItem('gourmet_orders') || '[]');
  }
}

/* --------------------------------------------------------------------------
   updateOrderStatus — Updates order status (Pending, Processing, Completed, Cancelled)
   -------------------------------------------------------------------------- */
export async function updateOrderStatus(orderId, newStatus) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      console.warn('Supabase status update error:', error);
    }
  } catch (err) {
    console.error('Failed to update status in Supabase:', err);
  }

  // Update local storage backup
  const local = JSON.parse(localStorage.getItem('gourmet_orders') || '[]');
  const idx = local.findIndex(o => o.id === orderId);
  if (idx !== -1) {
    local[idx].status = newStatus;
    localStorage.setItem('gourmet_orders', JSON.stringify(local));
  }
}

/* --------------------------------------------------------------------------
   SINGLE SLOT ADMIN ACCOUNT MANAGEMENT
   -------------------------------------------------------------------------- */

const LOCAL_ADMIN_KEY = 'gourmet_master_admin_slot';

// Check if an admin account has already been created (1-slot limit)
export async function checkAdminSlotStatus() {
  // 1. Check local storage single-slot record
  const localAdmin = localStorage.getItem(LOCAL_ADMIN_KEY);
  if (localAdmin) {
    try {
      const parsed = JSON.parse(localAdmin);
      if (parsed && parsed.email) {
        return { exists: true, admin: parsed };
      }
    } catch (e) {
      // invalid json
    }
  }

  // 2. Check Supabase `admin_account` table if created
  try {
    const { data, error } = await supabase
      .from('admin_account')
      .select('*')
      .limit(1);

    if (!error && data && data.length > 0) {
      const adminObj = {
        name: data[0].full_name || data[0].username || 'Admin',
        email: data[0].email,
        passwordHash: data[0].password_hash,
        createdAt: data[0].created_at
      };
      localStorage.setItem(LOCAL_ADMIN_KEY, JSON.stringify(adminObj));
      return { exists: true, admin: adminObj };
    }
  } catch (err) {
    console.warn('Supabase admin_account check:', err);
  }

  return { exists: false, admin: null };
}

// Register the SINGLE admin slot. Rejects if slot is already occupied.
export async function registerAdminSlot({ name, email, password }) {
  const status = await checkAdminSlotStatus();
  if (status.exists) {
    throw new Error('ADMIN SLOT FILLED: An admin account already exists. Only 1 admin account is allowed on this platform.');
  }

  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();

  const adminAccount = {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    passwordHash: passwordHash,
    createdAt: now
  };

  // Save to Supabase `admin_account` table
  try {
    const { error } = await supabase
      .from('admin_account')
      .insert([
        {
          full_name: adminAccount.name,
          email: adminAccount.email,
          password_hash: adminAccount.passwordHash,
          created_at: now
        }
      ]);
    if (error) {
      console.warn('Supabase insert admin_account warning (using local fallback):', error.message);
    }
  } catch (err) {
    console.warn('Supabase admin insert exception:', err);
  }

  // Save to Local Storage Single Slot
  localStorage.setItem(LOCAL_ADMIN_KEY, JSON.stringify(adminAccount));

  return adminAccount;
}

// Verify Admin Login Credentials
export async function verifyAdminLogin(emailOrUsername, password) {
  const status = await checkAdminSlotStatus();
  if (!status.exists) {
    throw new Error('NO ADMIN ACCOUNT FOUND: No admin account has been created yet. Please register using the available single slot.');
  }

  const inputHash = await hashPassword(password);
  const admin = status.admin;

  const inputEmail = emailOrUsername.trim().toLowerCase();
  if (admin.email.toLowerCase() === inputEmail && admin.passwordHash === inputHash) {
    return admin;
  }

  throw new Error('Invalid email/username or password. Access denied.');
}

