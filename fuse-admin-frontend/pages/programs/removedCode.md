     {false && activeTab === 'details' && (
                        <>
                            {/* Step Indicator for Create Mode */}
                    {isCreateMode && (
                        <div className="mb-8 flex items-center justify-center gap-3">
                            <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${currentStep === 1 ? 'bg-primary text-primary-foreground' : currentStep > 1 ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                                    }`}>
                                    {currentStep > 1 ? <Check className="h-4 w-4" /> : '1'}
                                </div>
                                <span className={`text-sm font-medium hidden sm:inline ${currentStep === 1 ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    Teleform
                                </span>
                            </div>
                            <div className="w-8 h-px bg-border"></div>
                            <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${currentStep === 2 ? 'bg-primary text-primary-foreground' : currentStep > 2 ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                                    }`}>
                                    {currentStep > 2 ? <Check className="h-4 w-4" /> : '2'}
                                </div>
                                <span className={`text-sm font-medium hidden sm:inline ${currentStep === 2 ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    Services
                                </span>
                            </div>
                            <div className="w-8 h-px bg-border"></div>
                            <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${currentStep === 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                                    }`}>
                                    3
                                </div>
                                <span className={`text-sm font-medium hidden sm:inline ${currentStep === 3 ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    Program Details
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Program Details (or Edit Mode) — hidden in edit mode */}
                    {(currentStep === 3 || false) && (
                        <div className="bg-card rounded-2xl shadow-sm border border-border p-6 mb-6">
                            <h3 className="text-lg font-semibold mb-4">Program Details</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Catalog Name <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="e.g., Weight Loss Catalog, Wellness Catalog"
                                        className="w-full"
                                    />
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-sm font-medium">
                                            Description (Optional)
                                        </label>
                                        <span className="text-xs text-muted-foreground">
                                            {116 - description.length} characters remaining
                                        </span>
                                    </div>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Describe what this program includes..."
                                        rows={3}
                                        maxLength={116}
                                        className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>

                                {!isCreateMode && (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="isActive"
                                            checked={isActive}
                                            onChange={(e) => setIsActive(e.target.checked)}
                                            className="rounded border-gray-300"
                                        />
                                        <label htmlFor="isActive" className="text-sm font-medium">
                                            Active
                                        </label>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 mt-6">
                                {isCreateMode ? (
                                    <>
                                    <Button
                                            variant="outline"
                                        onClick={() => setCurrentStep(2)}
                                        className="flex-1"
                                    >
                                            Back
                                    </Button>
                                        <Button
                                            onClick={handleSave}
                                            disabled={saving || !name.trim()}
                                            className="flex-1"
                                        >
                                            {saving ? 'Creating Program...' : 'Create Program'}
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button
                                            onClick={handleSave}
                                            disabled={saving || !name.trim()}
                                            className="flex-1"
                                        >
                                            {saving ? 'Saving...' : 'Save Changes'}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => router.push('/programs')}
                                        >
                                            Cancel
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 1: Choose Teleform (Create Mode Only) */}
                    {isCreateMode && currentStep === 1 && (
                        <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
                            <h3 className="text-lg font-semibold mb-4">Choose Teleform</h3>
                            <p className="text-sm text-muted-foreground mb-6">
                                Select a medical questionnaire template that will be used for patient intake in this program.
                            </p>

                            {/* Search */}
                            <div className="mb-6">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        value={templateSearch}
                                        onChange={(e) => setTemplateSearch(e.target.value)}
                                        placeholder="Search templates..."
                                        className="pl-9"
                                    />
                                </div>
                            </div>

                            {templatesLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : (
                                <>
                                    {/* Templates List */}
                                    <div className="space-y-2 mb-6 max-h-96 overflow-y-auto">
                                        {filteredTemplates.length > 0 ? (
                                            filteredTemplates.map((template) => {
                                                const products = template.formProducts
                                                    ?.map(fp => fp.product)
                                                    .filter((p): p is TemplateProduct => !!p) || []
                                                
                                                return (
                                                    <div
                                                        key={template.id}
                                                        onClick={() => setMedicalTemplateId(template.id)}
                                                        className={`p-4 border rounded-lg cursor-pointer transition-all ${medicalTemplateId === template.id
                                                                ? 'border-primary bg-primary/5 shadow-sm'
                                                                : 'border-border hover:border-primary/50 hover:bg-muted/50'
                                                            }`}
                                                    >
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                                                    <h4 className="text-sm font-medium">{template.title}</h4>
                                                                </div>
                                                                {template.description && (
                                                                    <p className="text-xs text-muted-foreground mt-1">
                                                                        {template.description}
                                                                    </p>
                                                                )}
                                                                <div className="flex items-center gap-2 mt-2">
                                                                    <Badge variant="secondary" className="text-xs">
                                                                        {template.user ? 'Custom' : 'System'}
                                                                    </Badge>
                                                                    {template.user && (
                                                                        <span className="text-xs text-muted-foreground">
                                                                            Created by {template.user.firstName} {template.user.lastName}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {/* Products Section */}
                                                                {products.length > 0 && (
                                                                    <div className="mt-3 pt-3 border-t border-border">
                                                                        <div className="flex items-center gap-1.5 mb-2">
                                                                            <Package className="h-3 w-3 text-muted-foreground" />
                                                                            <span className="text-xs font-medium text-muted-foreground">
                                                                                Products ({products.length})
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex flex-wrap gap-1.5">
                                                                            {products.slice(0, 5).map((product) => (
                                                                                <div
                                                                                    key={product.id}
                                                                                    className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-md"
                                                                                >
                                                                                    {product.imageUrl && (
                                                                                        <img
                                                                                            src={product.imageUrl}
                                                                                            alt={product.name}
                                                                                            className="w-4 h-4 rounded object-cover"
                                                                                        />
                                                                                    )}
                                                                                    <span className="text-xs truncate max-w-[120px]">
                                                                                        {product.name}
                                                                                    </span>
                                                                                </div>
                                                                            ))}
                                                                            {products.length > 5 && (
                                                                                <div className="px-2 py-1 bg-muted rounded-md">
                                                                                    <span className="text-xs text-muted-foreground">
                                                                                        +{products.length - 5} more
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {medicalTemplateId === template.id && (
                                                                <div className="ml-4">
                                                                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                                                        <Check className="h-4 w-4 text-primary-foreground" />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })
                                        ) : (
                                            <div className="text-center py-8 text-muted-foreground">
                                                <p className="text-sm">No templates found</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Navigation Buttons */}
                                    <div className="flex gap-3">
                                        <Button
                                            onClick={() => setCurrentStep(2)}
                                            className="flex-1"
                                        >
                                            Next: Non-Medical Services
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Step 2: Non-Medical Services (Create Mode Only) */}
                    {isCreateMode && currentStep === 2 && (
                        <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="h-5 w-5 text-primary" />
                                <h3 className="text-lg font-semibold">Configure Program</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mb-6">
                                Choose your pricing mode and configure non-medical services for this program.
                            </p>

                            <div className="bg-muted/40 border border-border rounded-lg p-4 mb-6">
                                <div className="flex flex-col gap-2 mb-3">
                                    <h4 className="text-sm font-semibold">All-In COGS Assumptions (editable)</h4>
                                    <p className="text-xs text-muted-foreground">
                                        Temporary calculator until fee infra is finalized. Values below apply to all products unless overridden later.
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1 block">Shipping Cost</label>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={defaultShippingCost}
                                            onChange={(e) => setDefaultShippingCost(parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1 block">Facilitation Fee</label>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={defaultFacilitationFee}
                                            onChange={(e) => setDefaultFacilitationFee(parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1 block">Platform Retained %</label>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            value={platformRetainedPercent}
                                            onChange={(e) => setPlatformRetainedPercent(parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <label className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={includePlatformRetainedInCogs}
                                                onChange={(e) => setIncludePlatformRetainedInCogs(e.target.checked)}
                                            />
                                            Include retained fee in COGS
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Show Products from Selected Template */}
                            {selectedTemplateDetails && selectedTemplateDetails.formProducts && selectedTemplateDetails.formProducts.length > 0 && (
                                <div className="mb-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Package className="h-5 w-5 text-blue-500" />
                                        <h3 className="text-base font-semibold">Products ({selectedTemplateDetails.formProducts.filter(fp => fp.product).length})</h3>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Products from template: <span className="font-medium text-foreground">{selectedTemplateDetails.title}</span>
                                        <br />
                                        <span className="text-xs">Click the circle next to a product to use its image as the program's display image on the frontend.</span>
                                    </p>
                                </div>
                            )}

                            {/* Program Pricing Mode - MOVED TO TOP */}
                            <div className="bg-muted/50 rounded-lg p-4 mb-6">
                                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    <Settings2 className="h-4 w-4" />
                                    Program Pricing Mode
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={handleSwitchToUnified}
                                        className={`p-4 rounded-lg border-2 text-left transition-all ${
                                            programMode === 'unified'
                                                ? 'border-primary bg-primary/5'
                                                : 'border-border hover:border-primary/50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                                programMode === 'unified' ? 'border-primary bg-primary' : 'border-muted-foreground/50'
                                            }`}>
                                                {programMode === 'unified' && <Check className="h-3 w-3 text-white" />}
                                            </div>
                                            <span className="font-medium">Unified Program</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground ml-6">
                                            One set of non-medical services and prices for all products
                                        </p>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setProgramMode('per_product')}
                                        className={`p-4 rounded-lg border-2 text-left transition-all ${
                                            programMode === 'per_product'
                                                ? 'border-primary bg-primary/5'
                                                : 'border-border hover:border-primary/50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                                programMode === 'per_product' ? 'border-primary bg-primary' : 'border-muted-foreground/50'
                                            }`}>
                                                {programMode === 'per_product' && <Check className="h-3 w-3 text-white" />}
                                            </div>
                                            <span className="font-medium">Per-Product Programs</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground ml-6">
                                            Unique program name, services, and prices for each product
                                        </p>
                                    </button>
                                </div>
                                {programMode === 'per_product' && (
                                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
                                        💡 Click "Configure" on each product below to set individual program name and pricing
                                    </p>
                                )}
                            </div>

                            {/* Product Cards */}
                            {selectedTemplateDetails && selectedTemplateDetails.formProducts && selectedTemplateDetails.formProducts.length > 0 && (
                                <div className="space-y-4 mb-6">
                                    {selectedTemplateDetails.formProducts
                                        .filter(fp => fp.product)
                                        .map((fp) => {
                                            const product = fp.product!
                                            const isDisplayProduct = frontendDisplayProductId === product.id
                                            
                                            return (
                                                <div key={fp.id} className={`border rounded-xl overflow-hidden transition-all ${isDisplayProduct ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}>
                                                    {/* Product Header */}
                                                    <div className="bg-muted/30 p-4 border-b border-border">
                                                        <div className="flex items-center gap-4">
                                                            {/* Display Image Selection Radio */}
                                                            <div className="flex flex-col items-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setFrontendDisplayProductId(isDisplayProduct ? null : product.id)}
                                                                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                                                        isDisplayProduct 
                                                                            ? 'border-primary bg-primary' 
                                                                            : 'border-muted-foreground/50 hover:border-primary/50'
                                                                    }`}
                                                                >
                                                                    {isDisplayProduct && <Check className="h-4 w-4 text-white" />}
                                                                </button>
                                                                <span className="text-[10px] text-muted-foreground">Display</span>
                                                            </div>

                                                            {/* Product Image */}
                                                            {product.imageUrl && (
                                                                <img
                                                                    src={product.imageUrl}
                                                                    alt={product.name}
                                                                    className="w-16 h-16 rounded-lg object-cover border border-border"
                                                                />
                                                            )}

                                                            {/* Product Info */}
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <h4 className="text-lg font-semibold">{product.name}</h4>
                                                                    {isDisplayProduct && (
                                                                        <Badge className="bg-black text-white text-xs">
                                                                            Frontend Display Image
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                {product.placeholderSig && (
                                                                    <p className="text-sm text-muted-foreground">
                                                                        <span className="font-medium">SIG:</span> {product.placeholderSig}
                                                                    </p>
                                                                )}
                                                            </div>

                                                            {/* COGS + Sell Price Preview */}
                                                            <div className="text-right min-w-[210px]">
                                                                {(() => {
                                                                    const pricing = getProductPricingPreview(product)
                                                                    return (
                                                                        <div className="space-y-1">
                                                                            <div className="text-xs text-muted-foreground uppercase">All-In COGS</div>
                                                                            <div className="text-xl font-bold">{formatPrice(pricing.allInCogs)}</div>
                                                                            <div className="text-[11px] text-muted-foreground">
                                                                                Product {formatPrice(pricing.baseProductCost)} + Shipping {formatPrice(pricing.shippingCost)} + Services {formatPrice(pricing.serviceTotal)} + Fees {formatPrice(pricing.facilitationFee + pricing.platformRetainedCost)}
                                                                            </div>
                                                                            <div className="flex items-center justify-end gap-2 pt-1">
                                                                                <span className="text-xs text-muted-foreground">Sell Price</span>
                                                                                <Input
                                                                                    type="number"
                                                                                    min="0"
                                                                                    step="0.01"
                                                                                    value={pricing.sellPrice}
                                                                                    onChange={(e) => updateProductSellPrice(product.id, e.target.value)}
                                                                                    className="w-24 h-8 text-right"
                                                                                />
                                                                            </div>
                                                                            <div className={`text-xs font-medium ${pricing.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                                                Net: {formatPrice(pricing.net)} ({pricing.marginPercent.toFixed(1)}%)
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                })()}
                                                            </div>

                                                            {/* Configure button for per-product mode */}
                                                            {programMode === 'per_product' && (
                                                                <Button
                                                                    size="sm"
                                                                    variant={individualProductPrograms[product.id] ? 'outline' : 'default'}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        openProductConfigModal(product)
                                                                    }}
                                                                    className="text-xs"
                                                                >
                                                                    <Settings2 className="h-3 w-3 mr-1" />
                                                                    {individualProductPrograms[product.id] ? 'Edit' : 'Configure'}
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Show configured status for per-product mode */}
                                                    {programMode === 'per_product' && individualProductPrograms[product.id] && (
                                                        <div className="p-4 bg-muted/10 border-t border-border">
                                                            <div className="flex items-center gap-2 text-sm">
                                                                <Check className="h-4 w-4 text-green-500" />
                                                                <span className="text-muted-foreground">
                                                                    Configured: <span className="font-medium text-foreground">{individualProductPrograms[product.id].programName}</span>
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                </div>
                            )}

                            {/* Non-Medical Services - Only show if Unified mode */}
                            {programMode === 'unified' && (
                                <>
                                    <h4 className="text-sm font-semibold mb-3">Non-Medical Services</h4>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Configure the services and prices that will apply to all products in this program.
                            </p>

                            {/* Services List */}
                            <div className="space-y-3 mb-6">
                                {/* Patient Portal */}
                                <div className={`p-4 border rounded-lg transition-all ${hasPatientPortal ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" checked={hasPatientPortal} onChange={(e) => setHasPatientPortal(e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary" />
                                            <span className="font-medium">Patient Portal</span>
                                        </div>
                                        {hasPatientPortal && (
                                            <div className="flex items-center gap-1">
                                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                <Input type="number" min="0" step="0.01" value={patientPortalPrice} onChange={(e) => setPatientPortalPrice(parseFloat(e.target.value) || 0)} className="w-24 text-right" placeholder="0.00" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* BMI Calculator */}
                                <div className={`p-4 border rounded-lg transition-all ${hasBmiCalculator ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" checked={hasBmiCalculator} onChange={(e) => setHasBmiCalculator(e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary" />
                                            <span className="font-medium">BMI Calculator</span>
                                        </div>
                                        {hasBmiCalculator && (
                                            <div className="flex items-center gap-1">
                                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                <Input type="number" min="0" step="0.01" value={bmiCalculatorPrice} onChange={(e) => setBmiCalculatorPrice(parseFloat(e.target.value) || 0)} className="w-24 text-right" placeholder="0.00" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Protein Intake Calculator */}
                                <div className={`p-4 border rounded-lg transition-all ${hasProteinIntakeCalculator ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" checked={hasProteinIntakeCalculator} onChange={(e) => setHasProteinIntakeCalculator(e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary" />
                                            <span className="font-medium">Protein Intake Calculator</span>
                                        </div>
                                        {hasProteinIntakeCalculator && (
                                            <div className="flex items-center gap-1">
                                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                <Input type="number" min="0" step="0.01" value={proteinIntakeCalculatorPrice} onChange={(e) => setProteinIntakeCalculatorPrice(parseFloat(e.target.value) || 0)} className="w-24 text-right" placeholder="0.00" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Calorie Deficit Calculator */}
                                <div className={`p-4 border rounded-lg transition-all ${hasCalorieDeficitCalculator ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" checked={hasCalorieDeficitCalculator} onChange={(e) => setHasCalorieDeficitCalculator(e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary" />
                                            <span className="font-medium">Calorie Deficit Calculator</span>
                                        </div>
                                        {hasCalorieDeficitCalculator && (
                                            <div className="flex items-center gap-1">
                                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                <Input type="number" min="0" step="0.01" value={calorieDeficitCalculatorPrice} onChange={(e) => setCalorieDeficitCalculatorPrice(parseFloat(e.target.value) || 0)} className="w-24 text-right" placeholder="0.00" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Easy Shopping */}
                                <div className={`p-4 border rounded-lg transition-all ${hasEasyShopping ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" checked={hasEasyShopping} onChange={(e) => setHasEasyShopping(e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary" />
                                            <span className="font-medium">Easy Shopping</span>
                                        </div>
                                        {hasEasyShopping && (
                                            <div className="flex items-center gap-1">
                                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                <Input type="number" min="0" step="0.01" value={easyShoppingPrice} onChange={(e) => setEasyShoppingPrice(parseFloat(e.target.value) || 0)} className="w-24 text-right" placeholder="0.00" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Summary */}
                            {(hasPatientPortal || hasBmiCalculator || hasProteinIntakeCalculator || hasCalorieDeficitCalculator || hasEasyShopping) && (
                                <div className="bg-muted/50 rounded-lg p-4 mb-6">
                                    <h4 className="text-sm font-medium mb-2">Selected Services Summary</h4>
                                    <div className="space-y-1">
                                        {hasPatientPortal && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Patient Portal</span>
                                                <span className="font-medium">{patientPortalPrice > 0 ? `$${patientPortalPrice.toFixed(2)}` : 'Free'}</span>
                                            </div>
                                        )}
                                        {hasBmiCalculator && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">BMI Calculator</span>
                                                <span className="font-medium">{bmiCalculatorPrice > 0 ? `$${bmiCalculatorPrice.toFixed(2)}` : 'Free'}</span>
                                            </div>
                                        )}
                                        {hasProteinIntakeCalculator && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Protein Intake Calculator</span>
                                                <span className="font-medium">{proteinIntakeCalculatorPrice > 0 ? `$${proteinIntakeCalculatorPrice.toFixed(2)}` : 'Free'}</span>
                                            </div>
                                        )}
                                        {hasCalorieDeficitCalculator && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Calorie Deficit Calculator</span>
                                                <span className="font-medium">{calorieDeficitCalculatorPrice > 0 ? `$${calorieDeficitCalculatorPrice.toFixed(2)}` : 'Free'}</span>
                                            </div>
                                        )}
                                        {hasEasyShopping && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Easy Shopping</span>
                                                <span className="font-medium">{easyShoppingPrice > 0 ? `$${easyShoppingPrice.toFixed(2)}` : 'Free'}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                    )}
                                </>
                            )}

                            {/* Navigation Buttons */}
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setCurrentStep(1)}
                                    className="flex-1"
                                >
                                    Back
                                </Button>
                                <Button
                                    onClick={() => setCurrentStep(3)}
                                    className="flex-1"
                                >
                                    Next: Catalog Name
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Edit Mode: Show Teleform Selection — hidden (managed in tenant portal) */}
                    {false && !isCreateMode && activeTab === 'details' && (
                        <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
                            <h3 className="text-lg font-semibold mb-4">Teleform</h3>

                            {/* Search */}
                            <div className="mb-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        value={templateSearch}
                                        onChange={(e) => setTemplateSearch(e.target.value)}
                                        placeholder="Search templates..."
                                        className="pl-9"
                                    />
                                </div>
                            </div>

                            {templatesLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {filteredTemplates.length > 0 ? (
                                        filteredTemplates.map((template) => {
                                            const products = template.formProducts
                                                ?.map(fp => fp.product)
                                                .filter((p): p is TemplateProduct => !!p) || []
                                            
                                            return (
                                                <div
                                                    key={template.id}
                                                    onClick={() => setMedicalTemplateId(template.id)}
                                                    className={`p-4 border rounded-lg cursor-pointer transition-all ${medicalTemplateId === template.id
                                                            ? 'border-primary bg-primary/5 shadow-sm'
                                                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                                                        }`}
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <FileText className="h-4 w-4 text-muted-foreground" />
                                                                <h4 className="text-sm font-medium">{template.title}</h4>
                                                            </div>
                                                            {template.description && (
                                                                <p className="text-xs text-muted-foreground mt-1">
                                                                    {template.description}
                                                                </p>
                                                            )}
                                                            <div className="flex items-center gap-2 mt-2">
                                                                <Badge variant="secondary" className="text-xs">
                                                                    {template.user ? 'Custom' : 'System'}
                                                                </Badge>
                                                                {template.user && (
                                                                    <span className="text-xs text-muted-foreground">
                                                                        Created by {template.user.firstName} {template.user.lastName}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {/* Products Section */}
                                                            {products.length > 0 && (
                                                                <div className="mt-3 pt-3 border-t border-border">
                                                                    <div className="flex items-center gap-1.5 mb-2">
                                                                        <Package className="h-3 w-3 text-muted-foreground" />
                                                                        <span className="text-xs font-medium text-muted-foreground">
                                                                            Products ({products.length})
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex flex-wrap gap-1.5">
                                                                        {products.slice(0, 5).map((product) => (
                                                                            <div
                                                                                key={product.id}
                                                                                className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-md"
                                                                            >
                                                                                {product.imageUrl && (
                                                                                    <img
                                                                                        src={product.imageUrl}
                                                                                        alt={product.name}
                                                                                        className="w-4 h-4 rounded object-cover"
                                                                                    />
                                                                                )}
                                                                                <span className="text-xs truncate max-w-[120px]">
                                                                                    {product.name}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                        {products.length > 5 && (
                                                                            <div className="px-2 py-1 bg-muted rounded-md">
                                                                                <span className="text-xs text-muted-foreground">
                                                                                    +{products.length - 5} more
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {medicalTemplateId === template.id && (
                                                            <div className="ml-4">
                                                                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                                                    <Check className="h-4 w-4 text-primary-foreground" />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })
                                    ) : (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <p className="text-sm">No templates found</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                        </>
                    )}
