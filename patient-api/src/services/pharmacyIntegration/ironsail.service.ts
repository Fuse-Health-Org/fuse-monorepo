import { google, sheets_v4 } from 'googleapis';

export interface IronSailProduct {
    id: string;
    sku: string;
    name: string;
    strength?: string;
    nameWithStrength?: string;
    dispense?: string;
    category?: string;
    price?: number;
    wholesalePrice?: number;
    suppliesPrice?: number;
    marketplacePricing?: number;
    pharmacy?: string;
    serviceProvider?: string;
    states?: string[];
    sig?: string;
    form?: string;
    displayName?: string;
    medicationName?: string;
    rxId?: string;
    [key: string]: any; // Allow additional fields from the spreadsheet
}

export class IronSailService {
    private sheets: sheets_v4.Sheets;
    private spreadsheetId = process.env.IRONSAIL_PRODUCTS_SPREADSHEET || process.env.IRONSAIL_FUSE_PRODUCTS_SPREADSHEET_ID || '1HLv6syjnQm3wtrYxnaS66CLsY0qaoyYTaQDqOYbzfgI';

    constructor() {
        // Initialize Google Sheets API with service account
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.SERVICE_ACCOUNT_CLIENT_EMAIL,
                private_key: process.env.SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        this.sheets = google.sheets({ version: 'v4', auth });
    }

    /**
     * Fetch products from the IronSail Google Spreadsheet
     * @param sheetName Optional sheet name (defaults to 'Sheet1')
     * @returns List of products from the spreadsheet
     */
    async getProducts(sheetName: string = 'Sheet1'): Promise<IronSailProduct[]> {
        try {
            console.log(`📊 Fetching IronSail products from spreadsheet: ${this.spreadsheetId}`);

            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A:Z`, // Read all columns from A to Z
            });

            const rows = response.data.values;
            if (!rows || rows.length === 0) {
                console.log('⚠️ No data found in IronSail spreadsheet');
                return [];
            }

            // First row contains headers
            const headers = rows[0].map(header =>
                String(header).trim().toLowerCase().replace(/\s+/g, '_')
            );

            console.log(`📋 Spreadsheet headers:`, headers);

            // Parse remaining rows as products
            const products: IronSailProduct[] = [];

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length === 0) continue;

                // Map row data to headers
                const product: any = {};
                headers.forEach((header, index) => {
                    if (row[index] !== undefined && row[index] !== '') {
                        product[header] = row[index];
                    }
                });

                // Skip empty rows or rows without medication name
                if (Object.keys(product).length === 0) continue;

                // New format columns (as of Jan 2026):
                // A: Name (empty), B: Medication (Pharmacy Name), C: Form, D: Pharmacy Pricing, 
                // E: Supplies (10 syringes + wipes), F: Marketplace Pricing, G: Pharmacy, 
                // H: Service Provider, I: States, J: SIG, K: RX_ID

                // Get medication name (pharmacy product name) - Column B
                const medicationName = product['medication_(pharmacy_name)'] || product.medication || product.medication_name;

                // Skip if no medication name
                if (!medicationName) continue;

                // Get display name - Column A (but it's often empty, so fallback to medication name)
                const displayName = product.name || medicationName;

                // Get form - Column C
                const form = product.form || 'Injectable';

                // Get pharmacy pricing - Column D (this is now the wholesale price)
                const pharmacyPricingValue = product.pharmacy_pricing || product.pricing;
                const pharmacyPricing = pharmacyPricingValue ? parseFloat(String(pharmacyPricingValue).replace(/[^0-9.]/g, '')) : undefined;

                // Get supplies price - Column E
                const suppliesValue = product['supplies_(10_syringes_+_wipes)'] || product.supplies;
                const suppliesPrice = suppliesValue ? parseFloat(String(suppliesValue).replace(/[^0-9.]/g, '')) : undefined;

                // Get marketplace pricing - Column F (new column, may be empty)
                const marketplacePricingValue = product.marketplace_pricing;
                const marketplacePricing = marketplacePricingValue ? parseFloat(String(marketplacePricingValue).replace(/[^0-9.]/g, '')) : undefined;

                // Use pharmacy pricing as wholesale price (no separate wholesale column anymore)
                const wholesalePrice = pharmacyPricing;

                // Get pharmacy - Column G
                const pharmacy = product.pharmacy || 'Kaduceus';

                // Get service provider - Column H
                const serviceProvider = product.service_provider || 'Ironsail';

                // Get states (comma-separated, parse into array) - Column I
                const statesValue = product.states || '';
                const states = statesValue ? statesValue.split(',').map((s: string) => s.trim()).filter(Boolean) : [];

                // Get SIG - Column J
                const sig = product.sig || 'Take as directed by your healthcare provider';

                // Get RX_ID - Column K
                const rxId = product.rx_id || product.rxid || undefined;

                // Debug logging for first product
                if (i === 1) {
                    console.log('🔍 IronSail spreadsheet raw product data (first row):', product);
                    console.log('🔍 Parsed values:', {
                        displayName,
                        medicationName,
                        form,
                        pharmacyPricing,
                        wholesalePrice,
                        marketplacePricing,
                        pharmacy,
                        states: states.length,
                        sig,
                        rxId
                    });
                }

                // Normalize to expected format
                const normalizedProduct: IronSailProduct = {
                    id: `ironsail-${medicationName.replace(/[^a-zA-Z0-9]/g, '-')}-${i}`,
                    sku: medicationName,
                    name: medicationName,
                    displayName: displayName,
                    medicationName: medicationName,
                    strength: undefined, // Not in format as separate field
                    nameWithStrength: medicationName,
                    dispense: form,
                    form: form,
                    category: undefined, // Not in format
                    price: pharmacyPricing || wholesalePrice,
                    suppliesPrice: suppliesPrice,
                    wholesalePrice: wholesalePrice,
                    marketplacePricing: marketplacePricing,
                    pharmacy: pharmacy,
                    serviceProvider: serviceProvider,
                    states: states,
                    sig: sig,
                    rxId: rxId,
                    // Keep all original fields for reference
                    _raw: product
                };

                products.push(normalizedProduct);
            }

            console.log(`✅ Successfully fetched ${products.length} products from IronSail`);
            return products;

        } catch (error) {
            console.error('❌ Error fetching IronSail products from spreadsheet:', error);
            if (error instanceof Error) {
                console.error('Error details:', error.message);
                console.error('Stack:', error.stack);
            }
            throw new Error(`Failed to fetch products from IronSail spreadsheet: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get products by state
     * @param state US State code
     * @returns List of products available in that state
     */
    async getProductsByState(state: string): Promise<IronSailProduct[]> {
        const allProducts = await this.getProducts();
        // Filter products that are available in the specified state
        return allProducts.filter(product =>
            product.states && product.states.includes(state)
        );
    }

    /**
     * Get all products available across all supported states
     * @param states Array of US State codes
     * @returns List of products available in any of those states
     */
    async getProductsByStates(states: string[]): Promise<IronSailProduct[]> {
        const allProducts = await this.getProducts();
        // Filter products that are available in at least one of the specified states
        return allProducts.filter(product =>
            product.states && product.states.some(s => states.includes(s))
        );
    }
}

