export type PrecheckLocale = "en-US" | "es-MX" | "fr-FR";

export const PRECHECK_LOCALE_STORAGE_KEY = "visitor-precheck-locale";

export const PRECHECK_LOCALE_OPTIONS: { value: PrecheckLocale; label: string }[] = [
  { value: "en-US", label: "English (US)" },
  { value: "es-MX", label: "Español (MX)" },
  { value: "fr-FR", label: "Français (FR)" },
];

export function isPrecheckLocale(v: string): v is PrecheckLocale {
  return v === "en-US" || v === "es-MX" || v === "fr-FR";
}

export type PrecheckStrings = {
  validating: string;
  loadingFallback: string;
  invalidTitle: string;
  invalidDefaultMessage: string;
  invalidContact: string;
  rejectedTitle: string;
  rejectedBody: string;
  rejectedNotePrefix: string;
  approvedTitle: string;
  approvedSubtitle: string;
  approvedDone: string;
  visitorCode: string;
  adminNote: string;
  approvedFooterScreenshot: string;
  pendingSavedTitle: string;
  pendingSavedBody: string;
  pendingSavedRateLimit: string;
  pendingSavedDone: string;
  labelVisitor: string;
  labelCompany: string;
  labelVisiting: string;
  labelReason: string;
  labelWhen: string;
  editAgain: string;
  pageTitle: string;
  pendingBanner: string;
  introKioskRegister: string;
  introKioskEmail: string;
  introAdmin: string;
  meetingHeader: string;
  requiredStar: string;
  firstName: string;
  lastName: string;
  companyLabel: string;
  companyPlaceholder: string;
  whoVisiting: string;
  whoPlaceholder: string;
  whoOtherPlaceholder: string;
  otherOption: string;
  reasonVisit: string;
  reasonPlaceholder: string;
  reasonOtherPlaceholder: string;
  kioskRegisterDateHint: string;
  visitDate: string;
  visitTime: string;
  additionalDetails: string;
  protocolViewLink: string;
  protocolCheckbox: string;
  submitting: string;
  updatePrecheck: string;
  completePrecheck: string;
  toastNameRequired: string;
  toastCompanyRequired: string;
  toastCompleteRequired: string;
  toastProtocol: string;
  toastInvalidWhen: string;
  toastFutureWhen: string;
  toastAlreadyProcessed: string;
  toastSavedEmail: string;
  toastSavedRateLimit: string;
};

const en: PrecheckStrings = {
  validating: "Validating your link...",
  loadingFallback: "Loading visitor pre-check...",
  invalidTitle: "Invalid or expired link",
  invalidDefaultMessage:
    "This visitor pre-check link is not valid. It may have expired (links are valid for 24 hours) or is no longer active.",
  invalidContact: "Please contact your host or request a new invitation.",
  rejectedTitle: "Request not approved",
  rejectedBody:
    "Your request wasn't approved. Please contact the company administrator.",
  rejectedNotePrefix: "Note from admin:",
  approvedTitle: "You're all set!",
  approvedSubtitle: "Show this code or QR at the kiosk to check in.",
  approvedDone: "Done! you can close this tab or window",
  visitorCode: "Visitor Code",
  adminNote: "Admin note:",
  approvedFooterScreenshot:
    "You can screenshot or print this page. The same code is stored in our system and will be recognized by the kiosk scanner.",
  pendingSavedTitle: "Saved!",
  pendingSavedBody:
    "Your visitor pre-check request is waiting for admin approval. You'll receive your visitor code by email once approved.",
  pendingSavedRateLimit:
    'To prevent email spam, we can only send updated "waiting for approval" emails once per minute. If you need to update again, try again in about a minute.',
  pendingSavedDone: "Done! you can close this tab or window",
  labelVisitor: "Visitor:",
  labelCompany: "Company:",
  labelVisiting: "Visiting:",
  labelReason: "Reason:",
  labelWhen: "When:",
  editAgain: "Edit again",
  pageTitle: "Visitor Pre-Check",
  pendingBanner:
    "Your request is waiting for admin approval. You can edit and resubmit your details if anything needs to change.",
  introKioskRegister:
    "You registered at our check-in device. You can update your details below if needed. Your link stays valid for 24 hours from when you registered. After any update, staff approval is still required; you'll receive your visitor code by email when approved.",
  introKioskEmail:
    "Complete this form before your visit. Your link is valid for 24 hours from when you requested it at the lobby screen. After submission, admin approval is required; you'll receive your visitor code (QR + PDF) by email after approval.",
  introAdmin:
    "Complete this form before your visit. Your link is valid for 24 hours from when the invitation was sent. After submission, admin approval is required; you'll receive your visitor code (QR + PDF) by email after approval.",
  meetingHeader: "What is your name?",
  requiredStar: "*",
  firstName: "First name",
  lastName: "Last name",
  companyLabel: "What company are you with?",
  companyPlaceholder: "Company or organization name",
  whoVisiting: "Who are you visiting?",
  whoPlaceholder: "Select who you are visiting",
  whoOtherPlaceholder: "Enter who you are visiting",
  otherOption: "Other",
  reasonVisit: "Reason for visit",
  reasonPlaceholder: "Select reason for visit",
  reasonOtherPlaceholder: "Enter reason for visit",
  kioskRegisterDateHint:
    "Visit date and time default to right now (when you open this page). Change them below if needed.",
  visitDate: "Visit date",
  visitTime: "Visit time",
  additionalDetails: "Additional details (optional)",
  protocolViewLink: "View visitor protocol (opens in a new tab)",
  protocolCheckbox:
    "I acknowledge read and receipt of the visitor protocol document sent with my invitation.",
  submitting: "Submitting...",
  updatePrecheck: "Update Pre-Check",
  completePrecheck: "Complete Pre-Check",
  toastNameRequired:
    "Please enter your first and last name so we know who we're meeting.",
  toastCompanyRequired: "Please enter your company name.",
  toastCompleteRequired: "Please complete all required fields.",
  toastProtocol: "Please acknowledge read and receipt of the visitor protocol.",
  toastInvalidWhen: "Please enter a valid visit date and time.",
  toastFutureWhen: "Please choose a future visit time.",
  toastAlreadyProcessed: "This request has already been processed by admin.",
  toastSavedEmail: "Saved! Waiting for admin approval (email sent).",
  toastSavedRateLimit:
    "Saved! Waiting for approval. Your confirmation email is limited to once per minute; your host is still notified of this update.",
};

const es: PrecheckStrings = {
  validating: "Validando su enlace...",
  loadingFallback: "Cargando registro previo de visitante...",
  invalidTitle: "Enlace no válido o vencido",
  invalidDefaultMessage:
    "Este enlace de registro previo no es válido. Puede haber vencido (los enlaces son válidos por 24 horas) o ya no estar activo.",
  invalidContact: "Comuníquese con su anfitrión o solicite una nueva invitación.",
  rejectedTitle: "Solicitud no aprobada",
  rejectedBody:
    "Su solicitud no fue aprobada. Comuníquese con el administrador de la empresa.",
  rejectedNotePrefix: "Nota del administrador:",
  approvedTitle: "¡Todo listo!",
  approvedSubtitle: "Muestre este código o el QR en el quiosco para registrarse.",
  approvedDone: "Listo: puede cerrar esta pestaña o ventana",
  visitorCode: "Código de visitante",
  adminNote: "Nota del administrador:",
  approvedFooterScreenshot:
    "Puede capturar o imprimir esta página. El mismo código está en nuestro sistema y lo reconocerá el escáner del quiosco.",
  pendingSavedTitle: "¡Guardado!",
  pendingSavedBody:
    "Su solicitud de registro previo está en espera de aprobación del administrador. Recibirá su código de visitante por correo cuando sea aprobada.",
  pendingSavedRateLimit:
    'Para evitar correo no deseado, solo podemos enviar correos de "en espera de aprobación" una vez por minuto. Si necesita actualizar de nuevo, intente en aproximadamente un minuto.',
  pendingSavedDone: "Listo: puede cerrar esta pestaña o ventana",
  labelVisitor: "Visitante:",
  labelCompany: "Empresa:",
  labelVisiting: "Visita a:",
  labelReason: "Motivo:",
  labelWhen: "Cuándo:",
  editAgain: "Editar de nuevo",
  pageTitle: "Registro previo de visitante",
  pendingBanner:
    "Su solicitud está en espera de aprobación del administrador. Puede editar y volver a enviar sus datos si algo debe cambiar.",
  introKioskRegister:
    "Se registró en nuestro dispositivo de entrada. Puede actualizar sus datos abajo si es necesario. Su enlace es válido por 24 horas desde el registro. Tras cualquier cambio, el personal aún debe aprobar; recibirá su código de visitante por correo al aprobarse.",
  introKioskEmail:
    "Complete este formulario antes de su visita. Su enlace es válido por 24 horas desde que lo solicitó en la pantalla del vestíbulo. Tras enviarlo, se requiere aprobación del administrador; recibirá su código de visitante (QR + PDF) por correo tras la aprobación.",
  introAdmin:
    "Complete este formulario antes de su visita. Su enlace es válido por 24 horas desde el envío de la invitación. Tras enviarlo, se requiere aprobación del administrador; recibirá su código de visitante (QR + PDF) por correo tras la aprobación.",
  meetingHeader: "¿Con quién tenemos el gusto?",
  requiredStar: "*",
  firstName: "Nombre",
  lastName: "Apellido",
  companyLabel: "¿De qué empresa es?",
  companyPlaceholder: "Empresa u organización",
  whoVisiting: "¿A quién visita?",
  whoPlaceholder: "Seleccione a quién visita",
  whoOtherPlaceholder: "Indique a quién visita",
  otherOption: "Otro",
  reasonVisit: "Motivo de la visita",
  reasonPlaceholder: "Seleccione el motivo",
  reasonOtherPlaceholder: "Indique el motivo de la visita",
  kioskRegisterDateHint:
    "La fecha y hora de visita son por defecto ahora (al abrir esta página). Cámbielas abajo si es necesario.",
  visitDate: "Fecha de visita",
  visitTime: "Hora de visita",
  additionalDetails: "Detalles adicionales (opcional)",
  protocolViewLink: "Ver protocolo para visitantes (se abre en una pestaña nueva)",
  protocolCheckbox:
    "Confirmo haber leído y recibido el documento de protocolo para visitantes enviado con mi invitación.",
  submitting: "Enviando...",
  updatePrecheck: "Actualizar registro previo",
  completePrecheck: "Completar registro previo",
  toastNameRequired: "Ingrese nombre y apellido para saber con quién nos reunimos.",
  toastCompanyRequired: "Ingrese el nombre de su empresa.",
  toastCompleteRequired: "Complete todos los campos obligatorios.",
  toastProtocol: "Confirme haber leído y recibido el protocolo para visitantes.",
  toastInvalidWhen: "Ingrese una fecha y hora de visita válidas.",
  toastFutureWhen: "Elija una hora de visita futura.",
  toastAlreadyProcessed: "Esta solicitud ya fue procesada por el administrador.",
  toastSavedEmail: "¡Guardado! En espera de aprobación (correo enviado).",
  toastSavedRateLimit:
    "¡Guardado! En espera de aprobación. Su correo de confirmación va una vez por minuto; su anfitrión sigue recibiendo aviso de esta actualización.",
};

const fr: PrecheckStrings = {
  validating: "Validation de votre lien...",
  loadingFallback: "Chargement du pré-enregistrement visiteur...",
  invalidTitle: "Lien invalide ou expiré",
  invalidDefaultMessage:
    "Ce lien de pré-enregistrement visiteur n'est pas valide. Il a peut-être expiré (validité 24 heures) ou n'est plus actif.",
  invalidContact: "Contactez votre hôte ou demandez une nouvelle invitation.",
  rejectedTitle: "Demande non approuvée",
  rejectedBody:
    "Votre demande n'a pas été approuvée. Veuillez contacter l'administrateur de l'entreprise.",
  rejectedNotePrefix: "Note de l'administrateur :",
  approvedTitle: "Tout est prêt !",
  approvedSubtitle: "Présentez ce code ou le QR à la borne pour vous enregistrer.",
  approvedDone: "Vous pouvez fermer cet onglet ou cette fenêtre",
  visitorCode: "Code visiteur",
  adminNote: "Note de l'administrateur :",
  approvedFooterScreenshot:
    "Vous pouvez faire une capture ou imprimer cette page. Le même code est enregistré dans notre système et sera reconnu par le scanner de la borne.",
  pendingSavedTitle: "Enregistré !",
  pendingSavedBody:
    "Votre demande de pré-enregistrement attend l'approbation de l'administrateur. Vous recevrez votre code visiteur par e-mail une fois approuvé.",
  pendingSavedRateLimit:
    'Pour limiter le spam, nous ne pouvons envoyer les e-mails « en attente d\'approbation » qu\'une fois par minute. Pour mettre à jour à nouveau, réessayez dans environ une minute.',
  pendingSavedDone: "Vous pouvez fermer cet onglet ou cette fenêtre",
  labelVisitor: "Visiteur :",
  labelCompany: "Entreprise :",
  labelVisiting: "Visite :",
  labelReason: "Motif :",
  labelWhen: "Quand :",
  editAgain: "Modifier à nouveau",
  pageTitle: "Pré-enregistrement visiteur",
  pendingBanner:
    "Votre demande attend l'approbation de l'administrateur. Vous pouvez modifier et renvoyer vos informations si nécessaire.",
  introKioskRegister:
    "Vous vous êtes enregistré sur notre borne d'accueil. Vous pouvez mettre à jour vos informations ci-dessous si besoin. Votre lien reste valable 24 heures après l'enregistrement. Après toute modification, l'approbation du personnel est toujours requise ; vous recevrez votre code visiteur par e-mail une fois approuvé.",
  introKioskEmail:
    "Complétez ce formulaire avant votre visite. Votre lien est valable 24 heures à partir de la demande sur l'écran du hall. Après envoi, l'approbation de l'administrateur est requise ; vous recevrez votre code visiteur (QR + PDF) par e-mail après approbation.",
  introAdmin:
    "Complétez ce formulaire avant votre visite. Votre lien est valable 24 heures à partir de l'envoi de l'invitation. Après envoi, l'approbation de l'administrateur est requise ; vous recevrez votre code visiteur (QR + PDF) par e-mail après approbation.",
  meetingHeader: "À qui avons-nous le plaisir ?",
  requiredStar: "*",
  firstName: "Prénom",
  lastName: "Nom",
  companyLabel: "Quelle entreprise représentez-vous ?",
  companyPlaceholder: "Nom de l'entreprise ou organisation",
  whoVisiting: "Qui visitez-vous ?",
  whoPlaceholder: "Sélectionnez la personne visitée",
  whoOtherPlaceholder: "Indiquez qui vous visitez",
  otherOption: "Autre",
  reasonVisit: "Motif de la visite",
  reasonPlaceholder: "Sélectionnez le motif",
  reasonOtherPlaceholder: "Indiquez le motif de la visite",
  kioskRegisterDateHint:
    "La date et l'heure de visite sont par défaut maintenant (à l'ouverture de cette page). Modifiez-les ci-dessous si besoin.",
  visitDate: "Date de visite",
  visitTime: "Heure de visite",
  additionalDetails: "Détails supplémentaires (facultatif)",
  protocolViewLink: "Consulter le protocole visiteur (s'ouvre dans un nouvel onglet)",
  protocolCheckbox:
    "Je confirme avoir lu et reçu le document de protocole visiteur envoyé avec mon invitation.",
  submitting: "Envoi en cours...",
  updatePrecheck: "Mettre à jour le pré-enregistrement",
  completePrecheck: "Terminer le pré-enregistrement",
  toastNameRequired:
    "Veuillez indiquer votre prénom et nom pour que nous sachions qui nous recevons.",
  toastCompanyRequired: "Veuillez indiquer le nom de votre entreprise.",
  toastCompleteRequired: "Veuillez remplir tous les champs obligatoires.",
  toastProtocol: "Veuillez confirmer la lecture et la réception du protocole visiteur.",
  toastInvalidWhen: "Veuillez saisir une date et une heure de visite valides.",
  toastFutureWhen: "Veuillez choisir une heure de visite future.",
  toastAlreadyProcessed: "Cette demande a déjà été traitée par l'administrateur.",
  toastSavedEmail: "Enregistré ! En attente d'approbation (e-mail envoyé).",
  toastSavedRateLimit:
    "Enregistré ! En attente d'approbation. Votre e-mail de confirmation est limité à une par minute ; votre hôte est quand même averti de cette mise à jour.",
};

const byLocale: Record<PrecheckLocale, PrecheckStrings> = {
  "en-US": en,
  "es-MX": es,
  "fr-FR": fr,
};

export function getPrecheckStrings(locale: PrecheckLocale): PrecheckStrings {
  return byLocale[locale] ?? en;
}
