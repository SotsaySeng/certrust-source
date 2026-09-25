{{- define "certrust.name" -}}
{{- .Chart.Name -}}
{{- end -}}

{{- define "certrust.fullname" -}}
{{- .Release.Name -}}
{{- end -}}

{{- define "certrust.labels" -}}
app.kubernetes.io/name: {{ include "certrust.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end -}}

{{- define "certrust.backend.fullname" -}}
{{- printf "%s-backend" (include "certrust.fullname" .) -}}
{{- end -}}

{{- define "certrust.backend.selectorLabels" -}}
app.kubernetes.io/name: {{ include "certrust.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: backend
{{- end -}}

{{- define "certrust.frontend.fullname" -}}
{{- printf "%s-frontend" (include "certrust.fullname" .) -}}
{{- end -}}

{{- define "certrust.frontend.selectorLabels" -}}
app.kubernetes.io/name: {{ include "certrust.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: frontend
{{- end -}}

{{- define "certrust.postgresql.fullname" -}}
{{- printf "%s-postgresql" (include "certrust.fullname" .) -}}
{{- end -}}

{{- define "certrust.postgresql.selectorLabels" -}}
app.kubernetes.io/name: {{ include "certrust.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: postgresql
{{- end -}}

{{- define "certrust.secretName" -}}
{{- printf "%s-secrets" (include "certrust.fullname" .) -}}
{{- end -}}

{{/*
Looks up an existing value in the already-deployed Secret (if any), falling
back to a freshly generated random string. Used so `helm upgrade` never
rotates a secret that was already generated on install. Usage:
{{ include "certrust.secretValue" (dict "root" $ "explicit" .Values.secrets.jwtSecret "key" "jwtSecret" "length" 32) }}
*/}}
{{- define "certrust.secretValue" -}}
{{- $explicit := .explicit -}}
{{- if $explicit -}}
{{- $explicit -}}
{{- else -}}
{{- $existing := lookup "v1" "Secret" .root.Release.Namespace (include "certrust.secretName" .root) -}}
{{- if $existing -}}
{{- index $existing.data .key | b64dec -}}
{{- else -}}
{{- randAlphaNum .length -}}
{{- end -}}
{{- end -}}
{{- end -}}
