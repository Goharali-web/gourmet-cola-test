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
  const { data, error } = await supabase
    .from('orders')
    .insert([
      {
        full_name:    orderData.fullName,
        email:        orderData.email,
        phone:        orderData.phone,
        address:      orderData.address,
        city:         orderData.city,
        pack_type:    orderData.packType,
        pack_price:   orderData.packPrice,
        quantity:     orderData.quantity,
        notes:        orderData.notes || null,
        created_at:   new Date().toISOString(),
      }
    ]);

  if (error) throw error;
  return data;
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
