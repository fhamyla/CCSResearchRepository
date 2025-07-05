const nodemailer = require('nodemailer');

// Configure nodemailer with environment variables
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL,
    pass: process.env.GMAIL_PASSWORD
  }
});

// Email service functions
const emailService = {
  // Send paper access email with attachment
  sendPaperAccessEmail: async (userEmail, paperData, paperContent, message) => {
    try {
      const emailOptions = {
        from: process.env.GMAIL,
        to: userEmail,
        subject: `Paper Access Request Approved: ${paperData.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 5px;">
            <h2 style="color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px;">Your Paper Request Has Been Approved</h2>
            
            <p>Dear User,</p>
            
            <p>Your request for access to the paper <strong>${paperData.title}</strong> has been approved by the administrator.</p>
            
            ${message ? `<p><strong>Admin Message:</strong> ${message}</p>` : ''}
            
            <p>You can find the requested paper attached to this email.</p>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <h3 style="margin-top: 0; color: #555;">Paper Details:</h3>
              <p><strong>Title:</strong> ${paperData.title}</p>
              <p><strong>Authors:</strong> ${formatAuthors(paperData.authors)}</p>
              ${paperData.journal ? `<p><strong>Journal:</strong> ${paperData.journal}</p>` : ''}
              ${paperData.year ? `<p><strong>Year:</strong> ${paperData.year}</p>` : ''}
              ${paperData.doi ? `<p><strong>DOI:</strong> ${paperData.doi}</p>` : ''}
            </div>
            
            <p>Thank you for using our Research Repository System.</p>
            
            <p style="margin-top: 30px; font-size: 0.9em; color: #777; border-top: 1px solid #eee; padding-top: 15px;">
              This is an automated email, please do not reply.
            </p>
          </div>
        `,
        attachments: [
          {
            filename: paperData.filename || `${paperData.title}.pdf`,
            content: paperContent,
            contentType: paperData.contentType || 'application/pdf'
          }
        ]
      };

      const info = await transporter.sendMail(emailOptions);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Email sending error:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  },

  // Send notification about request status
  sendRequestStatusEmail: async (userEmail, paperTitle, status, message) => {
    try {
      const emailOptions = {
        from: process.env.GMAIL,
        to: userEmail,
        subject: `Paper Request ${status === 'approved' ? 'Approved' : 'Rejected'}: ${paperTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 5px;">
            <h2 style="color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px;">
              Paper Request ${status === 'approved' ? 'Approved' : 'Rejected'}
            </h2>
            
            <p>Dear User,</p>
            
            <p>Your request for access to the paper <strong>${paperTitle}</strong> has been 
            ${status === 'approved' ? 'approved! You will receive another email with the paper attached.' : 'rejected.'}
            </p>
            
            ${message ? `<p><strong>Admin Message:</strong> ${message}</p>` : ''}
            
            <p>Thank you for using our Research Repository System.</p>
            
            <p style="margin-top: 30px; font-size: 0.9em; color: #777; border-top: 1px solid #eee; padding-top: 15px;">
              This is an automated email, please do not reply.
            </p>
          </div>
        `
      };

      const info = await transporter.sendMail(emailOptions);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Email sending error:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }
};

// Helper function to format authors array for email
function formatAuthors(authors) {
  if (!authors || !Array.isArray(authors)) return 'N/A';
  
  return authors.map(author => {
    if (typeof author === 'string') return author;
    if (typeof author === 'object') {
      if (author.name) return author.name;
      if (author.firstName && author.lastName) return `${author.firstName} ${author.lastName}`;
      return 'Unknown Author';
    }
    return 'Unknown Author';
  }).join(', ');
}

module.exports = emailService;
